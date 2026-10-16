package agent

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

const (
	TaskEventName = "agent:task"

	TaskQueued               = "queued"
	TaskRunning              = "running"
	TaskCompleted            = "completed"
	TaskFailed               = "failed"
	TaskCanceled             = "canceled"
	TaskInterrupted          = "interrupted"
	TaskAwaitingConfirmation = "awaiting_confirmation"
	TaskApproved             = "approved"
	TaskRejected             = "rejected"
	TaskApplying             = "applying"
	TaskApplied              = "applied"
	TaskConflict             = "conflict"
	TaskVerificationRequired = "verification_required"
)

// Task 是 thread 裡的一輪 Agent 工作；同一 thread 串行，不同 thread 可並行。
type Task struct {
	ID             string `json:"id"`
	AgentID        string `json:"agent_id"`
	ProjectID      string `json:"project_id"`
	ThreadID       string `json:"thread_id"`
	Prompt         string `json:"prompt"`
	State          string `json:"state"`
	Error          string `json:"error,omitempty"`
	CreatedAt      string `json:"created_at"`
	StartedAt      string `json:"started_at,omitempty"`
	FinishedAt     string `json:"finished_at,omitempty"`
	Partial        string `json:"partial,omitempty"`
	Progress       string `json:"progress,omitempty"`
	Activity       string `json:"activity,omitempty"`
	ActivityTarget string `json:"activity_target,omitempty"`
	// Slow 表示已超過 TaskTimeouts.Slow 仍未完成；只供畫面提示，不改變 State。
	Slow bool `json:"slow,omitempty"`
}

// TaskTimeouts 是單一 task 的等待上限，從開始執行起算（不含排隊），提案自動修正那一輪共用同一個計時。
// 超過 Slow 只提示「等待回應過長」，超過 Hard 才強制中斷；之後的「設定」頁會讓作者調整這兩個值。
type TaskTimeouts struct {
	Slow, Hard time.Duration
}

var DefaultTaskTimeouts = TaskTimeouts{Slow: 10 * time.Minute, Hard: 15 * time.Minute}

type TaskEvent struct {
	Type     string       `json:"type"`
	Task     Task         `json:"task"`
	Stream   *StreamEvent `json:"stream,omitempty"`
	Proposal *Proposal    `json:"proposal,omitempty"`
}

type TaskRunner func(context.Context, string, Request) (Reply, error)
type TaskEmitter func(TaskEvent)
type ProposalApplyRunner func(context.Context, Proposal, ProposalItem) (string, error)
type ProposalPrepareRunner func(context.Context, string, []ProposalItem) ([]ProposalItem, error)

var ErrApplyConflict = errors.New("proposal apply conflict")

type managedTask struct {
	task           Task
	req            Request
	cancel         context.CancelFunc
	proposal       *Proposal
	applyProposal  *Proposal
	proposalFilter proposalDeltaFilter
}

type taskQueue struct {
	running bool
	items   []*managedTask
}

type TaskManager struct {
	ctx     context.Context
	cancel  context.CancelFunc
	run     TaskRunner
	apply   ProposalApplyRunner
	prepare ProposalPrepareRunner
	emit    TaskEmitter

	mu       sync.Mutex
	timeouts TaskTimeouts
	tasks    map[string]*managedTask
	queues   map[string]*taskQueue
}

// SetProposalApplyRunner 注入 Writer 的 REST API 寫入器；Agent package 只負責佇列與對話生命週期。
func (m *TaskManager) SetProposalApplyRunner(apply ProposalApplyRunner) { m.apply = apply }

// SetProposalPrepareRunner 讓 Writer 在 proposal 落盤前，用 REST API 補齊可信任的版本基準。
func (m *TaskManager) SetProposalPrepareRunner(prepare ProposalPrepareRunner) { m.prepare = prepare }

func NewTaskManager(parent context.Context, run TaskRunner, emit TaskEmitter) *TaskManager {
	ctx, cancel := context.WithCancel(parent)
	if emit == nil {
		emit = func(TaskEvent) {}
	}
	return &TaskManager{ctx: ctx, cancel: cancel, run: run, emit: emit, timeouts: DefaultTaskTimeouts, tasks: map[string]*managedTask{}, queues: map[string]*taskQueue{}}
}

func (m *TaskManager) Start(agentID string, req Request) (Task, error) {
	if err := req.validate(); err != nil {
		return Task{}, err
	}
	id, err := newThreadID()
	if err != nil {
		return Task{}, err
	}
	thread, err := prepareTask(agentID, req, id)
	if err != nil {
		return Task{}, err
	}
	req.ThreadID = thread.ID
	task := Task{ID: id, AgentID: agentID, ProjectID: req.ProjectID, ThreadID: thread.ID, Prompt: req.Prompt, State: TaskQueued, CreatedAt: now()}
	managed := &managedTask{task: task, req: req}
	key := taskQueueKey(task)

	m.mu.Lock()
	m.tasks[id] = managed
	queue := m.queues[key]
	if queue == nil {
		queue = &taskQueue{}
		m.queues[key] = queue
	}
	queue.items = append(queue.items, managed)
	startQueue := false
	if !queue.running {
		queue.running = true
		startQueue = true
	}
	m.mu.Unlock()
	m.emit(TaskEvent{Type: EventTaskQueued, Task: task})
	if startQueue {
		go m.runQueue(key)
	}
	return task, nil
}

// Apply 將已核准 proposal 排回原 thread；實際寫入由 Writer 注入的 apply runner 執行，不再恢復 Agent session。
func (m *TaskManager) Apply(proposal Proposal) (Task, error) {
	if proposal.Status != ProposalApproved {
		return Task{}, errors.New("這批提案尚未取得作者允許")
	}
	m.mu.Lock()
	for _, existing := range m.tasks {
		if existing.applyProposal != nil && existing.applyProposal.ID == proposal.ID && (existing.task.State == TaskQueued || existing.task.State == TaskApplying) {
			task := existing.task
			m.mu.Unlock()
			return task, nil
		}
	}
	m.mu.Unlock()
	id, err := newThreadID()
	if err != nil {
		return Task{}, err
	}
	task := Task{ID: id, AgentID: proposal.AgentID, ProjectID: proposal.ProjectID, ThreadID: proposal.ThreadID, Prompt: "執行已核准提案", State: TaskQueued, CreatedAt: now()}
	proposal, err = recordApplyQueued(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID)
	if err != nil {
		return Task{}, err
	}
	managed := &managedTask{task: task, req: Request{ThreadID: proposal.ThreadID, ProjectID: proposal.ProjectID, Prompt: task.Prompt}, applyProposal: &proposal}
	key := taskQueueKey(task)
	m.mu.Lock()
	m.tasks[id] = managed
	queue := m.queues[key]
	if queue == nil {
		queue = &taskQueue{}
		m.queues[key] = queue
	}
	queue.items = append(queue.items, managed)
	startQueue := false
	if !queue.running {
		queue.running, startQueue = true, true
	}
	m.mu.Unlock()
	m.emit(TaskEvent{Type: EventTaskQueued, Task: task, Proposal: &proposal})
	if startQueue {
		go m.runQueue(key)
	}
	return task, nil
}

func (m *TaskManager) Cancel(taskID string) error {
	m.mu.Lock()
	managed, ok := m.tasks[taskID]
	if !ok {
		m.mu.Unlock()
		return errors.New("找不到這項工作")
	}
	switch managed.task.State {
	case TaskQueued:
		var err error
		if managed.applyProposal != nil {
			_, err = recordApplyFailed(managed.task.AgentID, managed.task.ProjectID, managed.task.ThreadID, managed.applyProposal.ID, managed.task.ID, "工作已停止", managed.task.Partial)
		} else {
			err = recordTaskStopped(managed.task.AgentID, managed.task.ProjectID, managed.task.ThreadID, managed.task.ID, TaskCanceled, "", managed.task.Partial)
		}
		if err != nil {
			m.mu.Unlock()
			return err
		}
		managed.task.State = TaskCanceled
		managed.task.FinishedAt = now()
		removeQueuedTask(m.queues[taskQueueKey(managed.task)], taskID)
		task := managed.task
		m.mu.Unlock()
		m.emit(TaskEvent{Type: EventTaskCanceled, Task: task})
		return nil
	case TaskRunning, TaskApplying:
		cancel := managed.cancel
		m.mu.Unlock()
		cancel()
		return nil
	default:
		m.mu.Unlock()
		return errors.New("這項工作已經結束")
	}
}

func (m *TaskManager) Close() { m.cancel() }

func (m *TaskManager) Active(projectID string) []Task {
	m.mu.Lock()
	defer m.mu.Unlock()
	tasks := []Task{}
	for _, managed := range m.tasks {
		if managed.task.ProjectID == projectID && (managed.task.State == TaskQueued || managed.task.State == TaskRunning || managed.task.State == TaskApplying) {
			tasks = append(tasks, managed.task)
		}
	}
	return tasks
}

func (m *TaskManager) runQueue(key string) {
	for {
		m.mu.Lock()
		queue := m.queues[key]
		if queue == nil || len(queue.items) == 0 {
			delete(m.queues, key)
			m.mu.Unlock()
			return
		}
		managed := queue.items[0]
		queue.items = queue.items[1:]
		ctx, cancel := context.WithCancel(m.ctx)
		managed.cancel = cancel
		managed.task.State = TaskRunning
		if managed.applyProposal != nil {
			managed.task.State = TaskApplying
		}
		managed.task.StartedAt = now()
		task := managed.task
		timeouts := m.timeouts
		m.mu.Unlock()
		if managed.applyProposal != nil {
			m.runApply(ctx, managed)
			cancel()
			continue
		}

		ctx, stopTimeout := context.WithTimeout(ctx, timeouts.Hard)
		slowTimer := time.AfterFunc(timeouts.Slow, func() { m.markSlow(managed) })
		err := recordTaskStarted(task.AgentID, task.ProjectID, task.ThreadID, task.ID)
		if err == nil {
			m.emit(TaskEvent{Type: EventTaskStarted, Task: task})
			req := managed.req
			var sessionID string
			sessionID, err = SessionOf(task.AgentID, task.ProjectID, task.ThreadID)
			if err == nil {
				req.SessionID = sessionID
				req.emit = func(stream StreamEvent) { m.stream(managed, stream) }
				err = m.draft(ctx, managed, task, req)
			}
		}
		slowTimer.Stop()
		contextErr := ctx.Err()
		// 超過上限是失敗而不是作者手動停止；改成可讀的失敗原因，partial 照常保留。
		if errors.Is(contextErr, context.DeadlineExceeded) {
			err = fmt.Errorf("%s 超過 %d 分鐘沒有完成，已中斷", providerDisplayName(task.AgentID), int(timeouts.Hard.Minutes()))
			contextErr = nil
		}
		stopTimeout()
		cancel()
		m.finish(managed, err, contextErr)
	}
}

// markSlow 只在 task 仍執行中時標記並即時通知；這是可重建的暫態，不寫入對話紀錄。
func (m *TaskManager) markSlow(managed *managedTask) {
	m.mu.Lock()
	if managed.task.State != TaskRunning {
		m.mu.Unlock()
		return
	}
	managed.task.Slow = true
	task := managed.task
	m.mu.Unlock()
	m.emit(TaskEvent{Type: EventTaskSlow, Task: task})
}

// draft 執行一輪 Agent 並保存結果。提案本身有問題時先保存原文，再續接同一 session 請 Agent 修正一次；
// 修正後仍失敗就結束，不再自動重試，避免燒額度。
func (m *TaskManager) draft(ctx context.Context, managed *managedTask, task Task, req Request) error {
	for repaired := false; ; repaired = true {
		reply, err := m.draftOnce(ctx, managed, task, req)
		var invalid *ProposalError
		if err == nil || ctx.Err() != nil || !errors.As(err, &invalid) {
			return err
		}
		// 基準建立或欄位驗證失敗時，錯誤本身不帶原文；從這輪回答補上。
		if invalid.SessionID == "" {
			invalid.SessionID = reply.SessionID
		}
		if invalid.Raw == "" {
			invalid.Raw = reply.raw
		}
		if invalid.Visible == "" {
			invalid.Visible = strings.TrimSpace(reply.Text)
		}
		if saveErr := recordProposalInvalid(task.AgentID, task.ProjectID, task.ThreadID, task.ID, invalid); saveErr != nil {
			return fmt.Errorf("%v；保存原始輸出時發生：%w", err, saveErr)
		}
		// 這輪的摘要已存成訊息；清掉 partial，避免失敗收尾時重複保存。
		m.mu.Lock()
		managed.task.Partial, managed.proposalFilter = "", proposalDeltaFilter{}
		current := managed.task
		m.mu.Unlock()
		m.emit(TaskEvent{Type: EventProposalInvalid, Task: current})
		if repaired || invalid.SessionID == "" {
			return err
		}
		req.SessionID, req.Prompt, req.References = invalid.SessionID, proposalRepairPrompt(invalid.Err), nil
	}
}

// draftOnce 是單一輪 CLI 執行：一般回答直接存檔；帶提案時先以 REST 建立基準，再落盤待作者確認。
func (m *TaskManager) draftOnce(ctx context.Context, managed *managedTask, task Task, req Request) (Reply, error) {
	reply, err := m.run(ctx, task.AgentID, req)
	m.flushProposalStream(managed)
	if ctx.Err() != nil {
		return reply, ctx.Err()
	}
	if err != nil {
		return reply, err
	}
	if len(reply.proposals) == 0 {
		return reply, recordTaskCompleted(task.AgentID, task.ProjectID, task.ThreadID, task.ID, reply)
	}
	if m.prepare != nil {
		if reply.proposals, err = m.prepare(ctx, task.ProjectID, reply.proposals); err != nil {
			return reply, err
		}
	}
	assetRoot := ""
	if proposalHasAsset(reply.proposals) {
		if assetRoot, err = req.dir(); err != nil {
			return reply, err
		}
	}
	proposal, err := saveTaskProposal(task.AgentID, task.ProjectID, task.ThreadID, task.ID, assetRoot, reply, reply.proposals)
	if err != nil {
		return reply, err
	}
	managed.proposal = &proposal
	return reply, nil
}

func (m *TaskManager) runApply(ctx context.Context, managed *managedTask) {
	task := managed.task
	proposal, err := recordApplyStarted(task.AgentID, task.ProjectID, task.ThreadID, managed.applyProposal.ID, task.ID)
	if err == nil {
		managed.applyProposal = &proposal
		m.emit(TaskEvent{Type: EventApplyStarted, Task: task, Proposal: &proposal})
		if m.apply == nil {
			err = errors.New("Writer 尚未設定提案寫入器")
		} else {
			for _, item := range proposal.ApplyItems() {
				proposal, err = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, EventApplyItemStarted, "")
				if err != nil {
					break
				}
				m.emit(TaskEvent{Type: EventApplyItemStarted, Task: task, Proposal: &proposal})
				_, err = m.apply(ctx, proposal, item)
				if ctx.Err() != nil {
					err = ctx.Err()
				}
				if err != nil {
					_, _ = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, EventApplyItemFailed, err.Error())
					m.emit(TaskEvent{Type: EventApplyItemFailed, Task: task, Proposal: &proposal})
					break
				}
				proposal, err = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, EventApplyItemDone, "")
				if err != nil {
					break
				}
				m.emit(TaskEvent{Type: EventApplyItemDone, Task: task, Proposal: &proposal})
			}
			if err == nil {
				summary := fmt.Sprintf("Writer 已依你的核准套用 %d 項提案。", len(proposal.ApplyItems()))
				proposal, err = recordApplyCompleted(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, summary)
			}
		}
	}
	contextErr := ctx.Err()
	conflicted := errors.Is(err, ErrApplyConflict)
	if err != nil {
		detail := err.Error()
		if contextErr != nil {
			detail = "工作已停止"
		}
		var failed Proposal
		var saveErr error
		if conflicted {
			failed, saveErr = recordApplyConflict(task.AgentID, task.ProjectID, task.ThreadID, managed.applyProposal.ID, task.ID, detail, managed.task.Partial)
		} else {
			failed, saveErr = recordApplyFailed(task.AgentID, task.ProjectID, task.ThreadID, managed.applyProposal.ID, task.ID, detail, managed.task.Partial)
		}
		if saveErr == nil {
			proposal = failed
		} else {
			err = fmt.Errorf("%v；保存失敗狀態時發生：%w", err, saveErr)
		}
	}
	m.mu.Lock()
	managed.task.FinishedAt = now()
	managed.task.State = TaskApplied
	if err != nil {
		managed.task.State, managed.task.Error = TaskFailed, err.Error()
	}
	if conflicted {
		managed.task.State = TaskConflict
	}
	if contextErr != nil {
		managed.task.State = TaskCanceled
	}
	task = managed.task
	m.mu.Unlock()
	eventType := EventApplyCompleted
	if err != nil {
		eventType = EventApplyFailed
	}
	if conflicted {
		eventType = EventApplyConflict
	}
	m.emit(TaskEvent{Type: eventType, Task: task, Proposal: &proposal})
}

func (m *TaskManager) finish(managed *managedTask, runErr, contextErr error) {
	m.mu.Lock()
	managed.cancel = nil
	managed.task.Progress, managed.task.Slow = "", false
	managed.task.FinishedAt = now()
	if contextErr != nil {
		managed.task.State = TaskCanceled
	} else if runErr != nil {
		managed.task.State = TaskFailed
		managed.task.Error = runErr.Error()
	} else if managed.proposal != nil {
		managed.task.State = TaskAwaitingConfirmation
	} else {
		managed.task.State = TaskCompleted
	}
	task := managed.task
	m.mu.Unlock()

	eventType := EventTaskCompleted
	if task.State == TaskAwaitingConfirmation {
		eventType = EventProposalReady
	} else if task.State != TaskCompleted {
		_ = recordTaskStopped(task.AgentID, task.ProjectID, task.ThreadID, task.ID, task.State, task.Error, task.Partial)
		if task.State == TaskCanceled {
			eventType = EventTaskCanceled
		} else {
			eventType = EventTaskFailed
		}
	}
	m.emit(TaskEvent{Type: eventType, Task: task, Proposal: managed.proposal})
}

func (m *TaskManager) stream(managed *managedTask, stream StreamEvent) {
	m.mu.Lock()
	activityType := ""
	switch stream.Type {
	case StreamAssistantDelta:
		stream.Text = managed.proposalFilter.Push(stream.Text)
		if stream.Text == "" {
			m.mu.Unlock()
			return
		}
		managed.task.Partial += stream.Text
	case StreamAgentPreview:
		managed.task.Progress = stream.Text
	case StreamAgentProgress:
		managed.task.Progress = ""
		activityType = EventTaskProgress
	case StreamToolStarted:
		managed.task.Activity = stream.ToolName
		managed.task.ActivityTarget = stream.ToolTarget
		activityType = EventTaskToolStarted
	case StreamToolCompleted, StreamToolFailed:
		if managed.task.Activity == stream.ToolName || stream.ToolName == "" {
			managed.task.Activity = ""
			managed.task.ActivityTarget = ""
		}
		if stream.Type == StreamToolCompleted {
			activityType = EventTaskToolFinished
		} else {
			activityType = EventTaskToolFailed
		}
	}
	task := managed.task
	m.mu.Unlock()
	if activityType != "" {
		if activityType == EventTaskProgress {
			_ = recordTaskProgress(task.AgentID, task.ProjectID, task.ThreadID, task.ID, stream.Text)
		} else {
			_ = recordTaskActivity(task.AgentID, task.ProjectID, task.ThreadID, task.ID, activityType, stream.ToolName, stream.ToolTarget)
		}
	}
	m.emit(TaskEvent{Type: stream.Type, Task: task, Stream: &stream})
}

func (m *TaskManager) flushProposalStream(managed *managedTask) {
	m.mu.Lock()
	text := managed.proposalFilter.Flush()
	if text == "" {
		m.mu.Unlock()
		return
	}
	managed.task.Partial += text
	task := managed.task
	m.mu.Unlock()
	stream := StreamEvent{Type: StreamAssistantDelta, Text: text}
	m.emit(TaskEvent{Type: stream.Type, Task: task, Stream: &stream})
}

func proposalHasAsset(items []ProposalItem) bool {
	for _, item := range items {
		if item.Kind == ProposalKindAsset {
			return true
		}
	}
	return false
}

func taskQueueKey(task Task) string { return task.AgentID + "/" + task.ProjectID + "/" + task.ThreadID }

func removeQueuedTask(queue *taskQueue, taskID string) {
	if queue == nil {
		return
	}
	for i, managed := range queue.items {
		if managed.task.ID == taskID {
			queue.items = append(queue.items[:i], queue.items[i+1:]...)
			return
		}
	}
}

package agent

const (
	EventMessageUser      = "message.user"
	EventMessageAssistant = "message.agent"
	EventMessagePartial   = "message.agent.partial"
	EventSystem           = "system"
	EventTaskQueued       = "task.queued"
	EventTaskStarted      = "task.started"
	EventTaskProgress     = "task.progress"
	EventTaskToolStarted  = "task.tool.started"
	EventTaskToolFinished = "task.tool.completed"
	EventTaskToolFailed   = "task.tool.failed"
	EventTaskCompleted    = "task.completed"
	EventTaskFailed       = "task.failed"
	EventTaskCanceled     = "task.canceled"
	// EventTaskSlow 只即時通知畫面「等待回應過長」，不落盤。
	EventTaskSlow         = "task.slow"
	EventProposalReady    = "proposal.ready"
	EventProposalInvalid  = "proposal.invalid"
	EventProposalApproved = "proposal.approved"
	EventProposalRejected = "proposal.rejected"
	EventApplyQueued      = "apply.queued"
	EventApplyStarted     = "apply.started"
	EventApplyItemStarted = "apply.item.started"
	EventApplyItemDone    = "apply.item.completed"
	EventApplyItemFailed  = "apply.item.failed"
	EventApplyCompleted   = "apply.completed"
	EventApplyFailed      = "apply.failed"
	EventApplyConflict    = "apply.conflict"
	EventApplyInterrupted = "apply.interrupted"
	EventApplyVerified    = "apply.verified"
)

// ChatLine 是 thread 的 append-only event。舊版只有 role/text；讀取時會補上 type，
// 讓既有對話不需 migration，也能逐步加入 proposal／decision／apply event。
type ChatLine struct {
	Type        string            `json:"type,omitempty"`
	Role        string            `json:"role,omitempty"`
	Text        string            `json:"text"`
	CreatedAt   string            `json:"created_at,omitempty"`
	TaskID      string            `json:"task_id,omitempty"`
	ProposalID  string            `json:"proposal_id,omitempty"`
	ItemID      string            `json:"item_id,omitempty"`
	ContentHash string            `json:"content_hash,omitempty"`
	EventID     string            `json:"event_id,omitempty"`
	ToolName    string            `json:"tool_name,omitempty"`
	ToolTarget  string            `json:"tool_target,omitempty"`
	Action      string            `json:"action,omitempty"`
	Commands    []string          `json:"commands,omitempty"`
	References  []PromptReference `json:"references,omitempty"`
}

func messageEvent(role, text string) ChatLine {
	typeName := EventMessageAssistant
	if role == "user" {
		typeName = EventMessageUser
	}
	id, _ := newThreadID()
	return ChatLine{Type: typeName, Role: role, Text: text, CreatedAt: now(), EventID: id}
}

func taskEvent(typeName, taskID, text string) ChatLine {
	id, _ := newThreadID()
	return ChatLine{Type: typeName, Role: "system", Text: text, CreatedAt: now(), TaskID: taskID, EventID: id}
}

// normalizeEvent 同時接受舊版 role/text 與新版 typed event。
func normalizeEvent(line ChatLine) (ChatLine, bool) {
	if line.Type == "" {
		if line.Role != "user" && line.Role != "assistant" {
			return ChatLine{}, false
		}
		line.Type = map[string]string{"user": EventMessageUser, "assistant": EventMessageAssistant}[line.Role]
		return line, true
	}
	switch line.Type {
	case EventMessageUser, EventProposalApproved, EventProposalRejected, EventApplyVerified:
		// 提案決策是使用者動作，在對話中保留成右側的決策紀錄。
		line.Role = "user"
	case EventMessageAssistant, EventMessagePartial:
		line.Role = "assistant"
	default:
		// proposal／decision／apply 等事件在對話裡以 system card 顯示。
		line.Role = "system"
	}
	return line, true
}

package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"
)

// Antigravity 用 agy 的雙向 JSONL 協定。Writer 每次只送一輪並在 stdin EOF 後結束程序，
// 下一輪以 conversation id 續接，避免常駐子程序跟 task lifecycle 分離。
type antigravityClient struct{ bin string }

func newAntigravity(bin string) Client { return antigravityClient{bin: bin} }

// agy 自己也有輸出上限；設成比 Writer 的 Hard 多一分鐘，讓中斷一律由 TaskManager 處理並顯示一致的原因。
func antigravityArgs(sessionID string, timeout time.Duration) []string {
	args := []string{
		"--input-format", "stream-json",
		"--output-format", "stream-json",
		"--mode", "plan",
		"--sandbox",
		"--print-timeout", fmt.Sprintf("%dm", int(math.Ceil(timeout.Minutes()))+1),
	}
	if sessionID != "" {
		args = append(args, "--conversation", sessionID)
	}
	return args
}

func antigravityInput(prompt string) (string, error) {
	data, err := json.Marshal(struct {
		Event   string `json:"event"`
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}{Event: "user", Message: struct {
		Content string `json:"content"`
	}{Content: prompt}})
	if err != nil {
		return "", err
	}
	return string(data) + "\n", nil
}

func (c antigravityClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	input, err := antigravityInput(req.body())
	if err != nil {
		return Reply{}, err
	}
	timeout := DefaultTaskTimeouts.Hard
	if deadline, ok := ctx.Deadline(); ok {
		timeout = time.Until(deadline)
	}
	return invoke(ctx, invocation{
		name:    "Antigravity",
		bin:     c.bin,
		dir:     dir,
		args:    antigravityArgs(req.SessionID, timeout),
		stdin:   input,
		decoder: &antigravityProtocol{tools: map[int]streamedTool{}},
		emit:    req.emit,
		resume:  req.SessionID,
	})
}

type antigravityProtocol struct{ tools map[int]streamedTool }

func (p *antigravityProtocol) Decode(line string) []protocolEvent {
	var event struct {
		Event          string `json:"event"`
		ConversationID string `json:"conversation_id"`
		StepUpdate     struct {
			ConversationID string `json:"conversation_id"`
			StepIndex      int    `json:"step_index"`
			State          string `json:"state"`
			StepType       string `json:"step_type"`
			ToolName       string `json:"tool_name"`
			TextDelta      string `json:"text_delta"`
			ToolInfo       struct {
				Name       string          `json:"name"`
				Parameters json.RawMessage `json:"parameters"`
				Error      json.RawMessage `json:"error"`
			} `json:"tool_info"`
		} `json:"step_update"`
		Result struct {
			ConversationID string `json:"conversation_id"`
			Status         string `json:"status"`
			Response       string `json:"response"`
			Error          string `json:"error"`
		} `json:"result"`
	}
	if json.Unmarshal([]byte(line), &event) != nil {
		return nil
	}
	switch event.Event {
	case "init":
		return []protocolEvent{{Type: protocolSession, SessionID: event.ConversationID}}
	case "step_update":
		step := event.StepUpdate
		events := []protocolEvent{}
		if step.ConversationID != "" {
			events = append(events, protocolEvent{Type: protocolSession, SessionID: step.ConversationID})
		}
		if step.StepType == "agent_response" && step.TextDelta != "" {
			return append(events, protocolEvent{Type: protocolTextDelta, Text: step.TextDelta})
		}
		if step.StepType != "tool" {
			return events
		}
		tool := streamedTool{Name: step.ToolName, Target: toolTarget(step.ToolInfo.Parameters)}
		if tool.Name == "" {
			tool.Name = step.ToolInfo.Name
		}
		stored, started := p.tools[step.StepIndex]
		if strings.EqualFold(step.State, "ACTIVE") {
			if !started {
				p.tools[step.StepIndex] = tool
				events = append(events, protocolEvent{Type: protocolToolStarted, ToolName: tool.Name, ToolTarget: tool.Target})
			}
			return events
		}
		if !strings.EqualFold(step.State, "DONE") {
			return events
		}
		if !started {
			stored = tool
			events = append(events, protocolEvent{Type: protocolToolStarted, ToolName: tool.Name, ToolTarget: tool.Target})
		}
		typeName := protocolToolCompleted
		if len(step.ToolInfo.Error) > 0 && string(step.ToolInfo.Error) != "null" {
			typeName = protocolToolFailed
		}
		return append(events, protocolEvent{Type: typeName, ToolName: stored.Name, ToolTarget: stored.Target})
	case "result":
		if strings.EqualFold(event.Result.Status, "SUCCESS") {
			return []protocolEvent{{Type: protocolCompleted, Text: event.Result.Response, SessionID: event.Result.ConversationID}}
		}
		message := strings.TrimSpace(event.Result.Error)
		if message == "" {
			message = fmt.Sprintf("Antigravity 工作未完成（%s）", event.Result.Status)
		}
		return []protocolEvent{{Type: protocolFailed, Text: message, SessionID: event.Result.ConversationID}}
	}
	return nil
}

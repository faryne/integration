package agent

const (
	StreamAssistantDelta = "assistant.delta"
	StreamAgentPreview   = "agent.preview"
	StreamAgentProgress  = "task.progress"
	StreamToolStarted    = "tool.started"
	StreamToolCompleted  = "tool.completed"
	StreamToolFailed     = "tool.failed"
)

// StreamEvent 是各家 CLI 輸出正規化後的事件；preview 只顯示當下狀態，progress 會進執行紀錄。
type StreamEvent struct {
	Type       string `json:"type"`
	Text       string `json:"text,omitempty"`
	ToolName   string `json:"tool_name,omitempty"`
	ToolTarget string `json:"tool_target,omitempty"`
}

func (r Request) emitStream(event StreamEvent) {
	if r.emit != nil {
		r.emit(event)
	}
}

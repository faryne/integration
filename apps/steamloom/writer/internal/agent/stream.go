package agent

const (
	StreamAssistantDelta = "assistant.delta"
	StreamToolStarted    = "tool.started"
	StreamToolCompleted  = "tool.completed"
)

// StreamEvent 是各家 CLI 輸出正規化後的暫態事件；delta 不逐段落盤，task 中斷時才合併保存。
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

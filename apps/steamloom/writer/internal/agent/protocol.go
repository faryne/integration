package agent

import (
	"errors"
	"strings"
)

type protocolEventType string

const (
	protocolSession       protocolEventType = "session"
	protocolTextDelta     protocolEventType = "text.delta"
	protocolTextCandidate protocolEventType = "text.candidate"
	protocolProgress      protocolEventType = "progress"
	protocolToolStarted   protocolEventType = "tool.started"
	protocolToolCompleted protocolEventType = "tool.completed"
	protocolToolFailed    protocolEventType = "tool.failed"
	protocolCompleted     protocolEventType = "completed"
	protocolFailed        protocolEventType = "failed"
	// protocolMCPUnavailable 表示 SteamLoom MCP 讀不到；Text 為 "auth" 時是確定的授權失效。
	protocolMCPUnavailable protocolEventType = "mcp.unavailable"
)

// protocolEvent 是 provider adapter 唯一能交給共用執行器的事件格式。
// CLI 的 raw JSON、terminal 名稱與 tool schema 都不得洩漏到 task lifecycle。
type protocolEvent struct {
	Type       protocolEventType
	Text       string
	SessionID  string
	ToolName   string
	ToolTarget string
	Server     string // MCP server 名稱，只用於 protocolMCPUnavailable
}

// protocolDecoder 只翻譯一家 CLI 的輸出，不負責停止程序、選定正式回答或改 task 狀態。
type protocolDecoder interface {
	Decode(string) []protocolEvent
}

type protocolState struct {
	sessionID string
	text      strings.Builder
	candidate string
	failed    string
	terminal  bool
	mcpErr    *MCPUnavailableError
	emit      func(StreamEvent)
}

func newProtocolState(resume string, emit func(StreamEvent)) *protocolState {
	if emit == nil {
		emit = func(StreamEvent) {}
	}
	return &protocolState{sessionID: resume, emit: emit}
}

func (s *protocolState) Consume(events []protocolEvent) bool {
	for _, event := range events {
		if s.terminal {
			break
		}
		s.consume(event)
	}
	return s.terminal
}

func (s *protocolState) consume(event protocolEvent) {
	if event.SessionID != "" {
		s.sessionID = event.SessionID
	}
	switch event.Type {
	case protocolSession:
	case protocolTextDelta:
		s.text.WriteString(event.Text)
		if event.Text != "" {
			s.emit(StreamEvent{Type: StreamAssistantDelta, Text: event.Text})
		}
	case protocolTextCandidate:
		// Codex 可能在同一 turn 送出多則完整 agent_message；只有 terminal 前最後一則是正式回答。
		if s.candidate != "" {
			s.emit(StreamEvent{Type: StreamAgentProgress, Text: s.candidate})
		}
		s.candidate = event.Text
		s.emit(StreamEvent{Type: StreamAgentPreview, Text: event.Text})
	case protocolProgress:
		if strings.TrimSpace(event.Text) != "" {
			s.emit(StreamEvent{Type: StreamAgentProgress, Text: event.Text})
		}
	case protocolToolStarted:
		s.emit(StreamEvent{Type: StreamToolStarted, ToolName: event.ToolName, ToolTarget: event.ToolTarget})
	case protocolToolCompleted:
		s.emit(StreamEvent{Type: StreamToolCompleted, ToolName: event.ToolName, ToolTarget: event.ToolTarget})
	case protocolToolFailed:
		s.emit(StreamEvent{Type: StreamToolFailed, ToolName: event.ToolName, ToolTarget: event.ToolTarget})
	case protocolCompleted:
		if event.Text != "" {
			s.text.Reset()
			s.text.WriteString(event.Text)
		} else if s.candidate != "" {
			s.text.Reset()
			s.text.WriteString(s.candidate)
		}
		s.candidate, s.terminal = "", true
		s.emit(StreamEvent{Type: StreamAgentPreview})
	case protocolMCPUnavailable:
		s.mcpErr = &MCPUnavailableError{Server: event.Server, AuthRequired: event.Text == "auth"}
		s.candidate, s.terminal = "", true
		s.emit(StreamEvent{Type: StreamAgentPreview})
	case protocolFailed:
		if s.candidate != "" {
			s.emit(StreamEvent{Type: StreamAgentProgress, Text: s.candidate})
		}
		s.candidate, s.failed, s.terminal = "", strings.TrimSpace(event.Text), true
		s.emit(StreamEvent{Type: StreamAgentPreview})
	}
}

func (s *protocolState) Reply() (Reply, error) {
	if s.mcpErr != nil {
		return Reply{}, s.mcpErr
	}
	if !s.terminal {
		return Reply{}, errors.New("Agent 輸出結束前沒有送出終局事件")
	}
	if s.failed != "" {
		return Reply{}, outputError{msg: s.failed}
	}
	text := s.text.String()
	if strings.TrimSpace(text) == "" {
		return Reply{}, errNoResult
	}
	return Reply{SessionID: s.sessionID, Text: text}, nil
}

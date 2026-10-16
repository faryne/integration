package agent

// Capability 描述 provider 能承接的工作型態；thread 只屬於 conversation，不是所有 adapter 的前提。
type Capability string

const (
	CapabilityConversation  Capability = "conversation"
	CapabilityImageGenerate Capability = "image.generate"
	CapabilityAudioGenerate Capability = "audio.generate"
	CapabilityVideoGenerate Capability = "video.generate"
)

// ProviderDescriptor 是 UI 與工作派送共用的穩定 metadata，provider-specific payload 不會進入 proposal apply layer。
type ProviderDescriptor struct {
	ID           string
	DisplayName  string
	Capabilities []Capability
}

type providerAdapter struct {
	descriptor ProviderDescriptor
	executable string
	open       func(string) Client
}

func conversationProvider(id, display, executable string, open func(string) Client) providerAdapter {
	return providerAdapter{descriptor: ProviderDescriptor{ID: id, DisplayName: display, Capabilities: []Capability{CapabilityConversation}}, executable: executable, open: open}
}

// catalog 是所有 adapter 的單一 registry；PixAI、Suno 等媒體 provider 之後由 capability 接入，不複製聊天生命週期。
var catalog = []providerAdapter{
	conversationProvider("claude", "Claude Code", "claude", newClaude),
	conversationProvider("codex", "Codex", "codex", newCodex),
	conversationProvider("grok", "Grok Build", "grok", newGrok),
	conversationProvider("gemini", "Gemini CLI", "gemini", newGemini),
	conversationProvider("antigravity", "Antigravity", "agy", newAntigravity),
}

// providerDisplayName 給錯誤訊息用；找不到就退回 id。
func providerDisplayName(id string) string {
	for _, item := range catalog {
		if item.descriptor.ID == id {
			return item.descriptor.DisplayName
		}
	}
	return id
}

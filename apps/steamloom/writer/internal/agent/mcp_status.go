package agent

import (
	"strconv"
	"strings"
	"sync"
)

// MCPUnavailableError 表示這輪 Agent 讀不到 SteamLoom MCP。prompt 已告訴 Agent 它能讀作品，
// 沒有工具時的回答只會是憑空捏造，所以偵測到就立即中斷，並附上重新授權的指令。
//
// 各家訊號（2026-10-16 實測）：
//   - Claude Code：stream-json init 的 mcp_servers[].status 為 needs-auth（未授權）或 failed（token 無效或連不上）。
//   - Codex：只在 stderr 出現 rmcp 的 AuthRequired，帶 steamloom.works 的 resource_metadata。
//   - Grok Build：授權失敗時工具直接不出現，沒有可靠訊號，不偵測。
//   - Gemini CLI：尚未實測。
type MCPUnavailableError struct {
	AgentID      string
	Server       string
	AuthRequired bool // false 代表 CLI 只回報連線失敗，無法區分授權失效或網路問題
}

func (e *MCPUnavailableError) Error() string {
	if e.AuthRequired {
		return providerDisplayName(e.AgentID) + " 的 SteamLoom MCP 授權已失效，讀不到作品內容，這輪已中斷"
	}
	return providerDisplayName(e.AgentID) + " 無法連上 SteamLoom MCP（可能是授權失效或網路問題），讀不到作品內容，這輪已中斷"
}

// Commands 是作者要在 Terminal 自行執行的重新授權指令；Writer 不碰 MCP 憑證。
func (e *MCPUnavailableError) Commands() []string {
	server := e.Server
	if strings.ContainsAny(server, " \t\"'") {
		server = strconv.Quote(server)
	}
	switch e.AgentID {
	case "claude":
		return []string{"claude mcp login " + server}
	case "codex":
		return []string{"codex mcp login " + server}
	default:
		return nil
	}
}

// codexMCPAuthRequired 判斷 Codex stderr 是否是 SteamLoom 的授權失敗；其他 MCP server 的錯誤不影響這輪。
func codexMCPAuthRequired(line string) bool {
	return strings.Contains(line, "AuthRequired") && strings.Contains(line, "steamloom.works")
}

// stderrDecoder 讓只在 stderr 回報狀態的 CLI 也能即時轉成共用事件。
type stderrDecoder interface {
	DecodeStderr(string) []protocolEvent
}

// lineWriter 把 stderr 依行交給 callback，並保留完整內容供失敗時顯示；callback 回 true 代表要中斷程序。
type lineWriter struct {
	mu      sync.Mutex
	all     strings.Builder
	partial string
	onLine  func(string) bool
	stop    func()
	stopped bool
}

func (w *lineWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.all.Write(p)
	if w.onLine == nil {
		return len(p), nil
	}
	lines := strings.Split(w.partial+string(p), "\n")
	w.partial = lines[len(lines)-1]
	for _, line := range lines[:len(lines)-1] {
		if !w.stopped && w.onLine(line) {
			w.stopped = true
			w.stop()
		}
	}
	return len(p), nil
}

func (w *lineWriter) String() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.all.String()
}

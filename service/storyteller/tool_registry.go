package storyteller

import "context"

// ToolHandlerFunc 執行一次工具呼叫。回傳值故意用 interface{}，不綁定任何傳輸協定的
// 結果格式——MCP server 會把它包成 CallToolResult（string 包成純文字 content，其餘
// 型別包成 JSON text content），未來的 provider tool-calling agent runner 會把它包成
// tool_result content block。Handler 本身完全不知道呼叫端是誰。
type ToolHandlerFunc func(ctx context.Context, arguments map[string]interface{}) (interface{}, error)

// ToolSpec 描述一個可以被 MCP server 或未來 agent runner 共用的工具，
// 跟任何傳輸協定（MCP JSON-RPC、provider tool-calling）無關。
//
// InputSchema 沿用 JSON Schema 格式（跟 service/mcp 現有 objectSchema／
// stringSchema／integerSchema 產出的格式相容），六家 AI provider 的
// tool-calling 大多也吃這個格式，之後 Phase 2 不用重新設計一套 schema。
type ToolSpec struct {
	Name        string
	Description string
	InputSchema map[string]interface{}
	Handler     ToolHandlerFunc
}

// ToolRegistry 是一份有序的工具清單。MCP server 在啟動時把整份清單轉成自己的
// Tool/RegisterTool；之後的 agent runner 會用同一份清單轉成 provider 的
// tools 欄位——兩邊都只讀這份清單，不會各自維護一份工具定義。
type ToolRegistry struct {
	specs []ToolSpec
}

// NewToolRegistry 建立一份空的工具清單，呼叫端用 Register 逐一加入。
func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{}
}

// Register 把一個工具加進清單，依照呼叫順序保留原本順序（MCP 工具列表原本
// 是什麼排列順序，轉過來之後維持一樣，不做任何排序）。
func (r *ToolRegistry) Register(spec ToolSpec) {
	r.specs = append(r.specs, spec)
}

// All 回傳目前清單裡的全部工具（回傳 slice 的拷貝，避免呼叫端拿到內部 slice
// 之後意外修改到 registry 本身的狀態）。
func (r *ToolRegistry) All() []ToolSpec {
	out := make([]ToolSpec, len(r.specs))
	copy(out, r.specs)
	return out
}

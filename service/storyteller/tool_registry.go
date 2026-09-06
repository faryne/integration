package storyteller

import (
	"context"
	"encoding/json"
)

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

// StorytellerToolRegistry 建立 MCP server 與 agent runner 共用的 storyteller 工具清單。
//
// 2026-09-05 之前這裡曾經多一份手寫的工具名稱清單，先把每個 provider function
// 的 spec 收進一個 name→spec 的 map，再照著那份清單逐一撈出來註冊——原意是想
// 固定住 MCP 工具列表的排列順序，但代價是兩份清單要手動保持同步：provider
// function 裡新增一個 spec 卻忘記把名字加進清單，會悄悄漏註冊；清單裡打錯字
// 或殘留已刪除的名字，Go map 對不存在的 key 回傳零值、不會 panic，會把一個
// 空殼 ToolSpec{} 註冊進去，兩種情況都不會在編譯期或啟動期報錯。查過
// `.All()` 的所有呼叫端（ReadOnlyStorytellerTools／MCP server 註冊／測試）
// 都是用名稱查找或 prefix 過濾，沒有任何地方依賴排列順序，於是拿掉那份清單，
// 直接照 provider function 本身的宣告順序註冊——順序改成「照 provider 分組」
// 而不是原本手寫清單的順序，但沒有人依賴那個順序，這個改動是安全的。
func StorytellerToolRegistry() *ToolRegistry {
	registry := NewToolRegistry()
	for _, specs := range [][]ToolSpec{
		storytellerProjectToolSpecs(),
		storytellerStoryToolSpecs(),
		storytellerLoreToolSpecs(),
		storytellerAssetToolSpecs(),
		storytellerVolumeToolSpecs(),
		storytellerChapterReadToolSpecs(),
	} {
		for _, spec := range specs {
			registry.Register(spec)
		}
	}
	return registry
}

// StorytellerMCPOnlyToolRegistry 回傳只給外部 MCP client 用、AI 助理面板看不到的工具。
// 目前只有章節寫入工具放在這裡；章節讀取工具因為 get_/list_ 命名會自然被主 registry
// 分類成唯讀工具，不需要另外維護允許清單。
func StorytellerMCPOnlyToolRegistry() *ToolRegistry {
	registry := NewToolRegistry()
	for _, spec := range storytellerChapterWriteToolSpecs() {
		registry.Register(spec)
	}
	return registry
}

func decodeArguments(arguments map[string]interface{}, out interface{}) error {
	body, err := json.Marshal(arguments)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, out)
}

func normalizedPage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

func objectSchema(properties map[string]interface{}, required []string) map[string]interface{} {
	schema := map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
	}
	if properties != nil {
		schema["properties"] = properties
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func stringSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "string",
		"description": description,
	}
}

func integerSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "integer",
		"description": description,
	}
}

func booleanSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "boolean",
		"description": description,
	}
}

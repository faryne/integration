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
func StorytellerToolRegistry() *ToolRegistry {
	specsByName := make(map[string]ToolSpec, 41)
	for _, specs := range [][]ToolSpec{
		storytellerProjectToolSpecs(),
		storytellerStoryToolSpecs(),
		storytellerLoreToolSpecs(),
		storytellerAssetToolSpecs(),
		storytellerVolumeToolSpecs(),
	} {
		for _, spec := range specs {
			specsByName[spec.Name] = spec
		}
	}

	registry := NewToolRegistry()
	for _, name := range []string{
		"storyteller_list_projects",
		"storyteller_get_project",
		"storyteller_list_stories",
		"storyteller_list_lores",
		"storyteller_get_story",
		"storyteller_upsert_story",
		"storyteller_patch_story",
		"storyteller_search_replace_story",
		"storyteller_revert_story",
		"storyteller_move_story",
		"storyteller_presign_image_upload",
		"storyteller_list_assets",
		"storyteller_get_asset",
		"storyteller_presign_asset_upload",
		"storyteller_confirm_asset_upload",
		"storyteller_presign_asset_replace",
		"storyteller_confirm_asset_replace",
		"storyteller_update_asset",
		"storyteller_move_asset",
		"storyteller_list_asset_collections",
		"storyteller_create_asset_collection",
		"storyteller_update_asset_collection",
		"storyteller_delete_asset_collection",
		"storyteller_delete_asset",
		"storyteller_upsert_image_story",
		"storyteller_delete_story",
		"storyteller_list_lore_collections",
		"storyteller_create_lore_collection",
		"storyteller_update_lore_collection",
		"storyteller_delete_lore_collection",
		"storyteller_list_volumes",
		"storyteller_create_volume",
		"storyteller_update_volume",
		"storyteller_delete_volume",
		"storyteller_move_lore",
		"storyteller_get_lore",
		"storyteller_upsert_lore",
		"storyteller_patch_lore",
		"storyteller_search_replace_lore",
		"storyteller_revert_lore",
		"storyteller_delete_lore",
	} {
		registry.Register(specsByName[name])
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

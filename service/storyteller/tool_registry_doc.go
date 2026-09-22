package storyteller

// ToolDoc／ToolDocCategory 是給「MCP 連接」設定頁的 SKILL.md 說明文件用的資料——
// 名稱與說明直接取自實際掛在 MCP server 上的 ToolSpec，不是另外手寫一份，新增／
// 刪除工具時這份文件會自動跟著變，不用回頭改前端文案。
type ToolDoc struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ToolDocCategory struct {
	Title string    `json:"title"`
	Tools []ToolDoc `json:"tools"`
}

// StorytellerToolDocCategories 依照創作者容易理解的分類（跟 tool_registry_*.go
// 檔案分組大致對應，但把 MCPOnly 那些「執行前還沒有 project_public_id」或帳號層級
// 的工具併回對應的分類，不單獨列一個「MCP 專用」分類讓讀者困惑）整理出完整工具
// 清單。任何地方新增 ToolSpec，只要掛進這裡對應的分組，文件就會自動列出來；忘記
// 掛的話這裡也不會生出不存在的工具，兩邊不會分岔。
func StorytellerToolDocCategories() []ToolDocCategory {
	groups := []struct {
		title string
		specs []ToolSpec
	}{
		{
			title: "專案",
			specs: append(
				append([]ToolSpec{}, storytellerProjectToolSpecs()...),
				storytellerProjectMCPOnlyToolSpecs()...,
			),
		},
		{title: "冊", specs: storytellerVolumeToolSpecs()},
		{title: "設定集 / 世界觀設定", specs: storytellerLoreToolSpecs()},
		{title: "故事 / 話", specs: storytellerStoryToolSpecs()},
		{
			title: "章節",
			specs: append(
				append([]ToolSpec{}, storytellerChapterReadToolSpecs()...),
				storytellerChapterWriteToolSpecs()...,
			),
		},
		{title: "資產 / 圖片上傳", specs: storytellerAssetToolSpecs()},
		{title: "筆名", specs: storytellerProfileMCPOnlyToolSpecs()},
	}

	categories := make([]ToolDocCategory, 0, len(groups))
	for _, group := range groups {
		tools := make([]ToolDoc, 0, len(group.specs))
		for _, spec := range group.specs {
			tools = append(tools, ToolDoc{Name: spec.Name, Description: spec.Description})
		}
		categories = append(categories, ToolDocCategory{Title: group.title, Tools: tools})
	}
	return categories
}

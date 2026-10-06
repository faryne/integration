package storyteller

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"fmt"
	"strings"
	"time"
)

// MCP 連接頁提供下載／安裝的 SteamLoom Skill。內文是 mcp_skill_template.md，規劃與修改紀錄見
// DevelopDocuments/storyteller/Skill規劃_2026-10-04.md；改內文時要同步更新版本號與日期。
const (
	// MCPSkillName 是 skill 名稱，也是安裝資料夾與 ZIP 內的資料夾名稱（Claude.ai 要求三者一致）。
	MCPSkillName      = "steamloom"
	MCPSkillVersion   = "2.3.0"
	MCPSkillUpdatedAt = "2026-10-06"
	// Skill 裡寫的連線位址一律用 steamloom.works：OAuth 只在這個網域開放，也是對外的品牌網址。
	mcpSkillEndpoint = "https://steamloom.works/mcp"
	// mcpSkillLegacyName 是改名前的 skill 名稱；安裝程式會移除這個資料夾（確認 SKILL.md 是舊版才刪）
	mcpSkillLegacyName = "storyteller-mcp"
)

//go:embed mcp_skill_template.md
var mcpSkillTemplate string

// 安裝程式範本：macOS／Linux 用 sh，Windows 用 PowerShell，各自有固定網址，server 不看 User-Agent
var (
	//go:embed mcp_skill_installer.sh
	mcpSkillInstallerSh string
	//go:embed mcp_skill_installer.ps1
	mcpSkillInstallerPs1 string
)

// MCPSkillInstaller 產生 Skill 安裝程式；ext 是 "sh" 或 "ps1"。安裝程式一律從 steamloom.works 下載
// SKILL.md（內容跟網域無關），版本號從下載到的 SKILL.md 讀，範本裡不寫死。
func MCPSkillInstaller(ext string) string {
	template := mcpSkillInstallerSh
	if ext == "ps1" {
		template = mcpSkillInstallerPs1
	}
	return strings.NewReplacer(
		"{{SKILL_NAME}}", MCPSkillName,
		"{{LEGACY_NAME}}", mcpSkillLegacyName,
		"{{SKILL_URL}}", mcpSkillEndpoint+"/skill.md",
		"{{INSTALLER_URL}}", mcpSkillEndpoint+"/skill-installer."+ext,
	).Replace(template)
}

// MCPSkillMarkdown 產生完整的 SKILL.md：範本填入版本、連線位址，以及 MCP server 目前實際掛載的工具清單
// （StorytellerToolDocCategories），新增／刪除工具不用回頭改範本。
func MCPSkillMarkdown() string {
	categories := StorytellerToolDocCategories()
	sections := make([]string, 0, len(categories))
	for _, category := range categories {
		lines := make([]string, 0, len(category.Tools))
		for _, tool := range category.Tools {
			lines = append(lines, fmt.Sprintf("- `%s` - %s", tool.Name, tool.Description))
		}
		sections = append(sections, fmt.Sprintf("### %s\n\n%s", category.Title, strings.Join(lines, "\n")))
	}
	return strings.NewReplacer(
		"{{SKILL_NAME}}", MCPSkillName,
		"{{VERSION}}", MCPSkillVersion,
		"{{UPDATED_AT}}", MCPSkillUpdatedAt,
		"{{MCP_ENDPOINT}}", mcpSkillEndpoint,
		"{{TOOL_LIST}}", strings.Join(sections, "\n\n"),
	).Replace(mcpSkillTemplate)
}

// MCPSkillZip 把 SKILL.md 包成 `steamloom/SKILL.md` 的 ZIP，給只收 ZIP 的 Claude.ai／ChatGPT 上傳。
func MCPSkillZip() ([]byte, error) {
	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	// 預設的 Create 沒有修改時間，解壓縮工具會顯示 1980 年；這裡帶上產生時間
	file, err := writer.CreateHeader(&zip.FileHeader{
		Name:     MCPSkillName + "/SKILL.md",
		Method:   zip.Deflate,
		Modified: time.Now(),
	})
	if err != nil {
		return nil, err
	}
	if _, err := file.Write([]byte(MCPSkillMarkdown())); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

package storyteller

import (
	"archive/zip"
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMCPSkillMarkdownFillsTemplate(t *testing.T) {
	md := MCPSkillMarkdown()

	require.True(t, strings.HasPrefix(md, "---\nname: steamloom\n"))
	require.Contains(t, md, `version: "`+MCPSkillVersion+`"`)
	require.Contains(t, md, "> 版本 "+MCPSkillVersion+"・最後更新 "+MCPSkillUpdatedAt)
	require.Contains(t, md, "https://steamloom.works/mcp")
	// 工具清單來自實際註冊的工具，抽兩個確認有填進去
	require.Contains(t, md, "- `storyteller_validate_content` - ")
	require.Contains(t, md, "- `storyteller_get_story` - ")
	require.NotContains(t, md, "{{")
	// 對外品牌統一寫 SteamLoom，description 不再出現 Storyteller
	frontmatter := md[:strings.Index(md[4:], "\n---")+4]
	require.NotContains(t, frontmatter, "Storyteller")
}

func TestMCPSkillZipContainsNamedFolder(t *testing.T) {
	data, err := MCPSkillZip()
	require.NoError(t, err)

	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	require.Len(t, reader.File, 1)
	require.Equal(t, "steamloom/SKILL.md", reader.File[0].Name)

	file, err := reader.File[0].Open()
	require.NoError(t, err)
	defer file.Close()
	content, err := io.ReadAll(file)
	require.NoError(t, err)
	require.Equal(t, MCPSkillMarkdown(), string(content))
}

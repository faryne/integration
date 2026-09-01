package storyteller

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// ErrAgentToolScopeViolation 代表某次工具呼叫的 project_public_id 引數跟這次對話
// 被授權的 project 對不上。這是開放問題 3 定案（AAS 操作範圍限縮到使用者明確授權
// 的單一 project）的實際落地方式：邊界建在工具執行前，不是信任模型自己遵守
// system prompt 裡「你只能動這個 project」這類指示——模型可能被誘導或自己判斷
// 錯誤而帶錯 project_public_id，物理上擋下來才是真的安全。
var ErrAgentToolScopeViolation = errors.New("tool call targeted a project outside this agent's authorized scope")

// storytellerProjectScopeArgumentKey 是 storyteller 全部 MCP 工具共用的慣例欄位
// 名稱（每個工具的 InputSchema 都用這個名字），見 tool_registry_*.go 各檔案。
const storytellerProjectScopeArgumentKey = "project_public_id"

// ScopeToolsToProject 把一組 ToolSpec 包一層 project 範圍檢查：每次呼叫的
// project_public_id 引數都要等於 authorizedProjectPublicID，不符合就直接拒絕、
// 連底層 Handler 都不會被呼叫到。
func ScopeToolsToProject(tools []ToolSpec, authorizedProjectPublicID string) []ToolSpec {
	scoped := make([]ToolSpec, len(tools))
	for i, spec := range tools {
		handler := spec.Handler
		spec.Handler = func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			calledProjectID, _ := arguments[storytellerProjectScopeArgumentKey].(string)
			if calledProjectID != authorizedProjectPublicID {
				return nil, fmt.Errorf("%w: tool call targeted %q, this agent is only authorized for %q",
					ErrAgentToolScopeViolation, calledProjectID, authorizedProjectPublicID)
			}
			return handler(ctx, arguments)
		}
		scoped[i] = spec
	}
	return scoped
}

// ReadOnlyStorytellerTools 過濾出唯讀工具（storyteller_get_*／storyteller_list_*），
// 排除任何會寫入／刪除／搬移資料的工具；storyteller_list_projects 也刻意排除，
// 因為它沒有 project_public_id，包上 ScopeToolsToProject 後一定會被擋，放進去只會
// 浪費 loop step。
func ReadOnlyStorytellerTools() []ToolSpec {
	all := StorytellerToolRegistry().All()
	out := make([]ToolSpec, 0, len(all))
	for _, spec := range all {
		if spec.Name == "storyteller_list_projects" {
			continue
		}
		if strings.HasPrefix(spec.Name, "storyteller_get_") || strings.HasPrefix(spec.Name, "storyteller_list_") {
			out = append(out, spec)
		}
	}
	return out
}

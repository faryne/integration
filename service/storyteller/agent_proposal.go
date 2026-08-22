package storyteller

import (
	"context"
	"errors"
	"strings"
)

// AgentProposal 是 agent 在對話中想呼叫寫入類工具、但沒有真的執行的請求，等
// 使用者在前端看過（Phase 6 的 diff 卡片）確認後，呼叫 ApplyAgentProposal 才會
// 真的落地。ToolCallID 對應 provider 那次 tool_use/tool_calls 的 id，純粹方便
// 前端／除錯時追溯，不是套用時的必要欄位。
type AgentProposal struct {
	ToolCallID string
	ToolName   string
	Arguments  map[string]interface{}
}

// proposalPendingResultText 是寫入類工具被攔截時，餵回給模型的合成結果——讓模型
// 知道「這個寫入還沒真的發生，已經記錄成提案等使用者確認」，不會誤以為呼叫失敗
// 而重試，也不會誤以為已經寫入成功而在後續回答裡宣稱事情已經做完。
const proposalPendingResultText = "This write was not applied. It has been recorded as a pending proposal; " +
	"nothing changed yet. The user needs to review and confirm it before it takes effect. You can mention in " +
	"your reply that you've prepared this change for the user to review, but do not claim it's already done."

// CaptureWriteToolsAsProposals 包一層 Handler：writeToolNames 清單裡的工具改成
// 不執行底層寫入邏輯，只回傳一個「已記錄、等待確認」的合成結果。真正被攔下來的
// 呼叫（含完整參數）事後用 ExtractProposals 從跑完的 AgentLoopResult 裡撈出來即
// 可，不需要另外維護一份執行期收集器——AgentLoopResult.Steps 本來就完整記錄了
// 每一輪的 ToolCalls。
func CaptureWriteToolsAsProposals(tools []ToolSpec, writeToolNames map[string]bool) []ToolSpec {
	captured := make([]ToolSpec, len(tools))
	for i, spec := range tools {
		if !writeToolNames[spec.Name] {
			captured[i] = spec
			continue
		}
		captured[i] = ToolSpec{
			Name:        spec.Name,
			Description: spec.Description,
			InputSchema: spec.InputSchema,
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return proposalPendingResultText, nil
			},
		}
	}
	return captured
}

// ExtractProposals 從跑完的 AgentLoopResult 裡挑出所有落在 writeToolNames 的
// 工具呼叫，當作這輪對話待確認的提案清單，維持原本發生的順序。
func ExtractProposals(result *AgentLoopResult, writeToolNames map[string]bool) []AgentProposal {
	if result == nil {
		return nil
	}
	var proposals []AgentProposal
	for _, step := range result.Steps {
		for _, call := range step.ToolCalls {
			if writeToolNames[call.Name] {
				proposals = append(proposals, AgentProposal{
					ToolCallID: call.ID,
					ToolName:   call.Name,
					Arguments:  call.Arguments,
				})
			}
		}
	}
	return proposals
}

// WriteStorytellerToolNames 回傳「非唯讀」工具的名稱集合（StorytellerToolRegistry
// 扣掉 ReadOnlyStorytellerTools 的部分）：upsert/delete/move/revert/presign/confirm
// 這類會實際改動資料或需要事後確認的工具。這份清單同時是 CaptureWriteToolsAsProposals
// 跟 ApplyAgentProposal 的授權允許清單——一個工具名稱只要不在這裡面，就永遠不能
// 透過 ApplyAgentProposal 執行，防止呼叫端亂傳工具名稱繞過提案機制直接執行唯讀
// 工具以外的東西。
func WriteStorytellerToolNames() map[string]bool {
	readOnly := make(map[string]bool)
	for _, spec := range ReadOnlyStorytellerTools() {
		readOnly[spec.Name] = true
	}
	names := make(map[string]bool)
	for _, spec := range StorytellerToolRegistry().All() {
		if !readOnly[spec.Name] {
			names[spec.Name] = true
		}
	}
	return names
}

// ErrAgentProposalToolNotAllowed 代表 ApplyAgentProposal 收到的 tool_name 不在
// WriteStorytellerToolNames 允許清單裡（可能是唯讀工具、也可能是完全不存在的
// 名稱）——這兩種都不該被當成「提案」執行。
var ErrAgentProposalToolNotAllowed = errors.New("tool is not an allowed write proposal target")

// ApplyAgentProposal 真正執行一個先前被 CaptureWriteToolsAsProposals 攔下來的
// 寫入提案。呼叫端（前端）要把先前收到的 AgentProposal.ToolName／Arguments 原樣
// 帶回來——這裡不做跨請求的提案儲存/查詢，提案本身的生命週期完全交給呼叫端保管，
// 這裡只負責「驗證這個工具名稱允許被這樣套用、驗證 project 範圍、真的執行」。
func (s *Service) ApplyAgentProposal(ctx context.Context, userID uint64, projectPublicID, toolName string, arguments map[string]interface{}) (interface{}, error) {
	return applyAgentProposal(ctx, s.repo, userID, projectPublicID, toolName, arguments)
}

func applyAgentProposal(ctx context.Context, repo agentRunRepository, userID uint64, projectPublicID, toolName string, arguments map[string]interface{}) (interface{}, error) {
	toolName = strings.TrimSpace(toolName)
	if !WriteStorytellerToolNames()[toolName] {
		return nil, ErrAgentProposalToolNotAllowed
	}
	if _, err := repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return nil, err
	}

	var target ToolSpec
	found := false
	for _, spec := range StorytellerToolRegistry().All() {
		if spec.Name == toolName {
			target = spec
			found = true
			break
		}
	}
	if !found {
		return nil, ErrAgentProposalToolNotAllowed
	}
	scoped := ScopeToolsToProject([]ToolSpec{target}, projectPublicID)[0]

	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_proposal")
	return scoped.Handler(ctx, arguments)
}

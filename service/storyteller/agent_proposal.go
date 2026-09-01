package storyteller

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
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

// buildAgentProposalRows 把跑完 agent loop 收集到的提案轉成要存進
// storyteller_agent_proposals 的資料列：PublicID 在存檔前就先產生好（跟這個 repo
// 其他資源一樣的模式），這樣呼叫端拿到的 HTTP 回應跟實際存進 DB 的是同一個
// public_id，不用等重新整理頁面才看得到；Arguments 序列化成 JSON 字串存放，跟
// StoryChatMessage.Metadata 同一種慣例。ChatID 留給呼叫端在 chat 建立後補上
// （見 repository CreateStoryChatWithMessages）。
func buildAgentProposalRows(proposals []AgentProposal) []storytellerModel.AgentProposal {
	rows := make([]storytellerModel.AgentProposal, 0, len(proposals))
	for _, p := range proposals {
		arguments, err := json.Marshal(p.Arguments)
		if err != nil {
			arguments = []byte("{}")
		}
		rows = append(rows, storytellerModel.AgentProposal{
			PublicID:   randomID(),
			ToolCallID: p.ToolCallID,
			ToolName:   p.ToolName,
			Arguments:  string(arguments),
			Status:     storytellerModel.AgentProposalStatusPending,
		})
	}
	return rows
}

// WriteStorytellerToolNames 回傳「真正需要提案確認」的工具名稱集合：
// StorytellerToolRegistry 扣掉 ReadOnlyStorytellerTools，再排除沒有 project_public_id、
// 不能被 ScopeToolsToProject 正常授權的 storyteller_list_projects。這份清單同時是
// CaptureWriteToolsAsProposals 跟 ApplyAgentProposal 的授權允許清單——一個工具名稱
// 只要不在這裡面，就永遠不能透過 ApplyAgentProposal 執行，防止呼叫端亂傳工具名稱。
func WriteStorytellerToolNames() map[string]bool {
	readOnly := make(map[string]bool)
	for _, spec := range ReadOnlyStorytellerTools() {
		readOnly[spec.Name] = true
	}
	names := make(map[string]bool)
	for _, spec := range StorytellerToolRegistry().All() {
		if spec.Name != "storyteller_list_projects" && !readOnly[spec.Name] {
			names[spec.Name] = true
		}
	}
	return names
}

// ErrAgentProposalToolNotAllowed 代表 ApplyAgentProposal 收到的 tool_name 不在
// WriteStorytellerToolNames 允許清單裡（可能是唯讀工具、也可能是完全不存在的
// 名稱）——這兩種都不該被當成「提案」執行。
var ErrAgentProposalToolNotAllowed = errors.New("tool is not an allowed write proposal target")

// ErrAgentProposalAlreadyResolved 代表這筆提案已經被套用或否決過，不能再處理
// 一次——不管是使用者自己連點兩下按鈕，還是分頁沒關、拿舊畫面重複送出。
var ErrAgentProposalAlreadyResolved = errors.New("agent proposal has already been applied or rejected")

// ApplyAgentProposal 用 public_id 找出先前被 CaptureWriteToolsAsProposals 攔下來、
// 已經存進 storyteller_agent_proposals 的寫入提案，驗證還是 pending 狀態後真的
// 執行，成功才把狀態標成 applied。提案的生命週期完全由後端保管（見 AgentProposal
// 的說明），呼叫端只需要帶 public_id，不用自己保存/回傳 tool_name、arguments。
func (s *Service) ApplyAgentProposal(ctx context.Context, userID uint64, projectPublicID, proposalPublicID string) (interface{}, error) {
	return applyAgentProposalByID(ctx, s.repo, userID, projectPublicID, proposalPublicID)
}

func applyAgentProposalByID(ctx context.Context, repo agentRunRepository, userID uint64, projectPublicID, proposalPublicID string) (interface{}, error) {
	if _, err := repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return nil, err
	}
	proposal, err := repo.AgentProposalByPublicIDForUser(userID, proposalPublicID)
	if err != nil {
		return nil, err
	}
	if proposal.Status != storytellerModel.AgentProposalStatusPending {
		return nil, ErrAgentProposalAlreadyResolved
	}
	var arguments map[string]interface{}
	if err := json.Unmarshal([]byte(proposal.Arguments), &arguments); err != nil {
		return nil, err
	}
	result, err := applyAgentProposal(ctx, repo, userID, projectPublicID, proposal.ToolName, arguments)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if rows, err := repo.UpdateAgentProposalStatus(proposal.ID, storytellerModel.AgentProposalStatusApplied, &now); err != nil {
		return nil, err
	} else if rows == 0 {
		// 真正的寫入已經執行完成，只是狀態欄位這一步沒搶到（跟另一個並發請求
		// 撞在一起）——不要把已經生效的結果丟掉假裝失敗，只是回一個警告性質的
		// 錯誤讓呼叫端知道狀態可能不同步，需要重新整理確認。
		return result, ErrAgentProposalAlreadyResolved
	}
	return result, nil
}

// RejectAgentProposal 把一筆還是 pending 的提案標成 rejected，不會真的執行底層
// 工具——單純讓使用者「已經看過、決定不套用」這件事持久化，重新整理頁面後
// 這張提案卡片才不會又打回「待確認」。
func (s *Service) RejectAgentProposal(ctx context.Context, userID uint64, projectPublicID, proposalPublicID string) error {
	return rejectAgentProposalByID(s.repo, userID, projectPublicID, proposalPublicID)
}

func rejectAgentProposalByID(repo agentRunRepository, userID uint64, projectPublicID, proposalPublicID string) error {
	if _, err := repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return err
	}
	proposal, err := repo.AgentProposalByPublicIDForUser(userID, proposalPublicID)
	if err != nil {
		return err
	}
	if proposal.Status != storytellerModel.AgentProposalStatusPending {
		return ErrAgentProposalAlreadyResolved
	}
	rows, err := repo.UpdateAgentProposalStatus(proposal.ID, storytellerModel.AgentProposalStatusRejected, nil)
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAgentProposalAlreadyResolved
	}
	return nil
}

// ErrAgentProposalNotAcknowledgeable 代表這筆提案的工具不是 upsert_story／
// upsert_lore，不能走「只標記、不執行」這條路——刪除/搬移/回退這類操作沒有
// 編輯區可以承接內容，前端唯一能做的就是真的呼叫 ApplyAgentProposal 執行，
// 不能假裝已經套用。
var ErrAgentProposalNotAcknowledgeable = errors.New("only upsert proposals can be marked applied without executing")

// MarkAgentProposalApplied 把一筆 upsert_story／upsert_lore 提案標成 applied，
// 但不執行底層工具——用在前端已經把提案內容填進編輯區、透過一般存檔 API
// （save_trigger=agent_apply）自己寫入過一次之後，只需要把這筆提案的狀態
// 收尾，不需要（也不該）讓後端再用提案裡的舊參數重寫一次，蓋掉使用者存檔
// 當下可能已經手動調整過的內容。
func (s *Service) MarkAgentProposalApplied(ctx context.Context, userID uint64, projectPublicID, proposalPublicID string) error {
	return markAgentProposalAppliedByID(s.repo, userID, projectPublicID, proposalPublicID)
}

func markAgentProposalAppliedByID(repo agentRunRepository, userID uint64, projectPublicID, proposalPublicID string) error {
	if _, err := repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return err
	}
	proposal, err := repo.AgentProposalByPublicIDForUser(userID, proposalPublicID)
	if err != nil {
		return err
	}
	if !isUpsertProposalTool(strings.TrimSpace(proposal.ToolName)) {
		return ErrAgentProposalNotAcknowledgeable
	}
	if proposal.Status != storytellerModel.AgentProposalStatusPending {
		return ErrAgentProposalAlreadyResolved
	}
	now := time.Now()
	rows, err := repo.UpdateAgentProposalStatus(proposal.ID, storytellerModel.AgentProposalStatusApplied, &now)
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAgentProposalAlreadyResolved
	}
	return nil
}

// ResetAgentProposalToPending 把一筆 applied 的提案退回 pending、清掉
// applied_at——用在使用者按下「回復到套用前版本」把故事/設定集內容退回去之後，
// 這筆提案代表的決定也要一併撤銷：不這樣做的話，提案會永遠卡在 applied，
// 畫面上只剩「查看變更」能按，使用者沒辦法回頭改變主意重新套用或改成否決。
func (s *Service) ResetAgentProposalToPending(ctx context.Context, userID uint64, projectPublicID, proposalPublicID string) error {
	return resetAgentProposalToPendingByID(s.repo, userID, projectPublicID, proposalPublicID)
}

func resetAgentProposalToPendingByID(repo agentRunRepository, userID uint64, projectPublicID, proposalPublicID string) error {
	if _, err := repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return err
	}
	proposal, err := repo.AgentProposalByPublicIDForUser(userID, proposalPublicID)
	if err != nil {
		return err
	}
	if proposal.Status != storytellerModel.AgentProposalStatusApplied {
		return ErrAgentProposalAlreadyResolved
	}
	rows, err := repo.ResetAppliedAgentProposalToPending(proposal.ID)
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrAgentProposalAlreadyResolved
	}
	return nil
}

const (
	upsertStoryToolName = "storyteller_upsert_story"
	upsertLoreToolName  = "storyteller_upsert_lore"
)

func isUpsertProposalTool(toolName string) bool {
	return toolName == upsertStoryToolName || toolName == upsertLoreToolName
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

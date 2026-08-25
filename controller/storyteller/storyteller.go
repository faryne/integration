package storyteller

import (
	"errors"
	"strconv"
	"strings"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	authService "faryne.dev/service/auth"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// optionalViewerID resolves the caller's user ID from the encrypt-key header
// when present, without requiring authentication like authsession.New() does.
// Used by public endpoints that show extra data (e.g. hidden favorites) to
// the profile owner while keeping the route open to anonymous visitors.
func optionalViewerID(ctx fiber.Ctx) uint64 {
	encryptKey := strings.TrimSpace(ctx.Get(authsession.HeaderEncryptKey))
	if encryptKey == "" {
		return 0
	}
	session, err := authService.GetSessionByEncryptKey(encryptKey)
	if err != nil {
		return 0
	}
	return session.UserId
}

// SearchWorks 是全站作品搜尋（文字故事／圖像作品共用），公開端點、不需要登入。
func SearchWorks(ctx fiber.Ctx) error {
	var req storyteller.WorkSearchRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	raw, rows, currentOffset, err := storyteller.NewService().SearchWorks(req)
	if err != nil {
		return output.ESError(err)
	}
	var nextSearchAfter []any
	if len(raw.Hits.Hits) > 0 {
		nextSearchAfter = raw.Hits.Hits[len(raw.Hits.Hits)-1].Sort
	}
	pagination, err := serviceHelper.PaginateByES(ctx, serviceHelper.ESPaginateInput[[]storyteller.WorkSearchResult]{
		Data:            rows,
		Total:           raw.Hits.Total.Value,
		PerPage:         req.PerPageValue(storyteller.SearchResultPageSize),
		CurrentCursor:   req.Cursor,
		CurrentOffset:   currentOffset,
		NextSearchAfter: nextSearchAfter,
		RowsCount:       int64(len(rows)),
	})
	if err != nil {
		return output.ESError(err)
	}
	return output.Success(pagination)
}

// SearchProjectsGrouped 是全站作品搜尋的「依專案分組」版本：篩選條件跟 SearchWorks
// 完全一樣，差別是同一個專案命中的多篇故事會收成一組，見 Service.SearchProjectsGrouped。
func SearchProjectsGrouped(ctx fiber.Ctx) error {
	var req storyteller.WorkSearchRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	rows, total, currentOffset, nextSearchAfter, err := storyteller.NewService().SearchProjectsGrouped(req)
	if err != nil {
		return output.ESError(err)
	}
	pagination, err := serviceHelper.PaginateByES(ctx, serviceHelper.ESPaginateInput[[]storyteller.ProjectSearchResult]{
		Data:            rows,
		Total:           total,
		PerPage:         req.PerPageValue(storyteller.SearchResultPageSize),
		CurrentCursor:   req.Cursor,
		CurrentOffset:   currentOffset,
		NextSearchAfter: nextSearchAfter,
		RowsCount:       int64(len(rows)),
	})
	if err != nil {
		return output.ESError(err)
	}
	return output.Success(pagination)
}

func PublicProjects(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PublicProjects()
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func PublicUserProjects(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("pageSize", "20"))
	rows, total, author, err := storyteller.NewService().PublicUserProjects(ctx.Params("username"), page, pageSize)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("user not found"))
		}
		return output.DBError(err)
	}
	return output.Success(map[string]any{
		"items":  rows,
		"total":  total,
		"author": author,
	})
}

func PublicFavoriteProjects(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PublicFavoriteProjects(ctx.Params("username"), optionalViewerID(ctx))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("user not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

func PublicFavoriteAuthors(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PublicFavoriteAuthors(ctx.Params("username"), optionalViewerID(ctx))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("user not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

func PublicProject(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().PublicProject(ctx.Params("project"), optionalViewerID(ctx))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func SharedProject(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().SharedProject(ctx.Params("token"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func Projects(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().Projects(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func Project(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().Project(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func CreateProject(ctx fiber.Ctx) error {
	var input storytellerModel.ProjectRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateProject(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateProject(ctx fiber.Ctx) error {
	var input storytellerModel.ProjectRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateProject(authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteProject(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteProject(authsession.Session(ctx).UserId, ctx.Params("project")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func Agents(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().Agents(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func AgentProviderModels(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().AgentProviderModels()
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func ProviderAPIKeys(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().ProviderAPIKeys(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func CreateProviderAPIKey(ctx fiber.Ctx) error {
	var input storytellerModel.ProviderAPIKeyRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateProviderAPIKey(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateProviderAPIKey(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("apikey"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.ProviderAPIKeyUpdateRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateProviderAPIKey(authsession.Session(ctx).UserId, id, input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("provider api key not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteProviderAPIKey(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("apikey"))
	if err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteProviderAPIKey(authsession.Session(ctx).UserId, id); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("provider api key not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func TestProviderAPIKey(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("apikey"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.ProviderAPIKeyTestRequest
	_ = ctx.Bind().Body(&input) // 沒有 body 也視為合法請求，沿用 catalog 的第一個 model 測試
	if err := storyteller.NewService().TestProviderAPIKey(ctx.Context(), authsession.Session(ctx).UserId, id, input.ModelName); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("provider api key not found"))
		}
		if isAgentProviderError(err) {
			return output.ExternalServiceError(err)
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"ok": true})
}

func AgentUsageSummary(ctx fiber.Ctx) error {
	month := ctx.Query("month")
	rows, err := storyteller.NewService().AgentUsageSummary(authsession.Session(ctx).UserId, month)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func AgentUsageLogs(ctx fiber.Ctx) error {
	providerAPIKeyID, err := parseUint(ctx.Query("provider_apikey_id"))
	if err != nil {
		return output.BadRequest(err)
	}
	storyID, err := parseOptionalUint(ctx.Query("story_id"))
	if err != nil {
		return output.BadRequest(err)
	}
	loreID, err := parseOptionalUint(ctx.Query("lore_id"))
	if err != nil {
		return output.BadRequest(err)
	}
	if storyID == nil && loreID == nil {
		return output.BadRequest(errors.New("story_id or lore_id is required"))
	}
	month := ctx.Query("month")
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("per_page", "20"))
	rows, total, err := storyteller.NewService().AgentUsageLogs(authsession.Session(ctx).UserId, providerAPIKeyID, storyID, loreID, month, page, pageSize)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("provider api key not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]any{
		"items":    rows,
		"total":    total,
		"page":     page,
		"per_page": pageSize,
	})
}

func Agent(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().Agent(authsession.Session(ctx).UserId, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func AgentPromptVersions(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	rows, err := storyteller.NewService().AgentPromptVersions(authsession.Session(ctx).UserId, id)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

func AgentPromptVersion(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	versionID, err := parseUint(ctx.Params("version"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().AgentPromptVersion(authsession.Session(ctx).UserId, id, versionID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent prompt version not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func CreateAgent(ctx fiber.Ctx) error {
	var input storytellerModel.AgentRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateAgent(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateAgent(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AgentRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateAgent(authsession.Session(ctx).UserId, id, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteAgent(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteAgent(authsession.Session(ctx).UserId, id); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func RunAgent(ctx fiber.Ctx) error {
	agentID, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AgentRunRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().RunAgent(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), agentID, input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent or story not found"))
		}
		if isAgentProviderError(err) {
			return output.ExternalServiceError(err)
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func RunLoreAgent(ctx fiber.Ctx) error {
	agentID, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AgentRunRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().RunLoreAgent(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), agentID, input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent or lore not found"))
		}
		if isAgentProviderError(err) {
			return output.ExternalServiceError(err)
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

// RunStoryAgenticQuery 是 AAS（agentic AI storyteller）聊天視窗的送出需求端點，
// 對照既有 RunAgent（單輪、無工具呼叫能力的改寫/擴寫/翻譯 skill）：這個是多輪、
// 會自己呼叫唯讀工具查資料、寫入類工具會被攔截成待確認提案的問答功能，兩者刻意
// 分開的路由，不共用同一個 handler。
func RunStoryAgenticQuery(ctx fiber.Ctx) error {
	agentID, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AgenticQueryRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	result, err := storyteller.NewService().RunStoryAgenticQuery(
		ctx.Context(),
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("story"),
		agentID,
		input.UserPrompt,
		storyteller.AgenticQueryOptions{
			ProviderAPIKeyID:   input.ProviderAPIKeyID,
			ModelName:          input.ModelName,
			IgnoreAgentPersona: input.IgnoreAgentPersona,
		},
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent or story not found"))
		}
		if isAgentProviderError(err) {
			return output.ExternalServiceError(err)
		}
		// ErrAgentLoopMaxStepsExceeded 這種情況 result 仍然有值（累積到中止那刻
		// 的 Steps/Usage 已經記進 usage log／chat 歷史），所以不能直接回錯誤了事，
		// 要把已經算出來的部分回給前端，只是標一個 warning 讓前端知道沒拿到最終
		// 答案——回應形狀跟正常成功時完全一樣（都是 AgenticQueryResponse），前端
		// 不用另外處理一種特殊的錯誤回應格式。
		if result != nil {
			response := result.ToResponse()
			response.Warning = err.Error()
			return output.Success(response)
		}
		return output.BadRequest(err)
	}
	return output.Success(result.ToResponse())
}

// RunLoreAgenticQuery 是 RunStoryAgenticQuery 的設定集版本，見
// storyteller.RunLoreAgenticQuery 的說明——同一個 ApplyAgentProposal 端點就能
// 套用兩邊產生的提案，不需要另外分開。
func RunLoreAgenticQuery(ctx fiber.Ctx) error {
	agentID, err := parseUint(ctx.Params("agent"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AgenticQueryRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	result, err := storyteller.NewService().RunLoreAgenticQuery(
		ctx.Context(),
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("lore"),
		agentID,
		input.UserPrompt,
		storyteller.AgenticQueryOptions{
			ProviderAPIKeyID:   input.ProviderAPIKeyID,
			ModelName:          input.ModelName,
			IgnoreAgentPersona: input.IgnoreAgentPersona,
		},
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller agent or lore not found"))
		}
		if isAgentProviderError(err) {
			return output.ExternalServiceError(err)
		}
		if result != nil {
			response := result.ToResponse()
			response.Warning = err.Error()
			return output.Success(response)
		}
		return output.BadRequest(err)
	}
	return output.Success(result.ToResponse())
}

// ApplyAgentProposal 套用先前 RunStoryAgenticQuery 回傳、存進
// storyteller_agent_proposals 的寫入類提案。前端只需要帶 public_id——提案的
// tool_name／arguments 由後端自己查，不再信任前端原樣送回來的值，順便讓套用
// 之後的狀態有地方持久化（見 AgentProposal 的說明）。
func ApplyAgentProposal(ctx fiber.Ctx) error {
	result, err := storyteller.NewService().ApplyAgentProposal(
		ctx.Context(),
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("proposal"),
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project or proposal not found"))
		}
		if errors.Is(err, storyteller.ErrAgentProposalToolNotAllowed) || errors.Is(err, storyteller.ErrAgentToolScopeViolation) {
			return output.Unauthorized(err)
		}
		return output.BadRequest(err)
	}
	return output.Success(result)
}

// RejectAgentProposal 把一筆還沒被處理的提案標成 rejected，不會真的執行——單純
// 讓「使用者已經看過、決定不套用」這件事持久化，重新整理頁面後這張提案卡片才
// 不會又打回「待確認」。
func RejectAgentProposal(ctx fiber.Ctx) error {
	err := storyteller.NewService().RejectAgentProposal(
		ctx.Context(),
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("proposal"),
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project or proposal not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]any{"status": "rejected"})
}

// MarkAgentProposalApplied 把一筆 upsert_story／upsert_lore 提案標成 applied，
// 不執行底層工具——前端已經把提案內容填進編輯區、用一般存檔 API 自己寫入過，
// 這裡只負責把提案狀態收尾，同時避免後端拿提案裡的舊參數把使用者存檔當下
// 可能又調整過的內容蓋掉。
func MarkAgentProposalApplied(ctx fiber.Ctx) error {
	err := storyteller.NewService().MarkAgentProposalApplied(
		ctx.Context(),
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("proposal"),
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project or proposal not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]any{"status": "applied"})
}

// ResetAgentProposal 把一筆已經 applied 的提案退回 pending——前端在「回復到套用
// 前版本」成功之後呼叫，讓這筆提案的決定跟著撤銷，使用者可以重新選擇套用或
// 否決，不會卡在只剩「查看變更」可以按的死路。
func ResetAgentProposal(ctx fiber.Ctx) error {
	err := storyteller.NewService().ResetAgentProposalToPending(
		ctx.Context(),
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("proposal"),
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project or proposal not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]any{"status": "pending"})
}

func isAgentProviderError(err error) bool {
	return errors.Is(err, storyteller.ErrAIProviderInvalidAPIKey) ||
		errors.Is(err, storyteller.ErrAIProviderRateLimited) ||
		errors.Is(err, storyteller.ErrAIProviderTimeout) ||
		errors.Is(err, storyteller.ErrAIProviderUnavailable) ||
		errors.Is(err, storyteller.ErrAIProviderInvalidModel) ||
		errors.Is(err, storyteller.ErrAIProviderEmptyResult) ||
		errors.Is(err, storyteller.ErrAIProviderUnknown) ||
		errors.Is(err, storyteller.ErrAIProviderUnsupported)
}

func Stories(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().Stories(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func Story(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().Story(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func CreateStory(ctx fiber.Ctx) error {
	var input storytellerModel.StoryRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateStory(authsession.Session(ctx).UserId, ctx.Params("project"), input, webVersionSource(input.SaveTrigger))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

// storyUpdateOutput 在正常的故事欄位外多帶一個 version_conflict，標記這次存檔用的
// base_version_id 是不是已經不是最新版本（例如被 MCP 工具或另一個分頁動過）；
// 只是提示旗標，內容一樣照常存成新版本，前端自己決定要不要提醒使用者。
type storyUpdateOutput struct {
	storytellerModel.Story
	VersionConflict bool `json:"version_conflict"`
}

func UpdateStory(ctx fiber.Ctx) error {
	var input storytellerModel.StoryRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, conflicted, err := storyteller.NewService().UpdateStory(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), input, webVersionSource(input.SaveTrigger))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(storyUpdateOutput{Story: *row, VersionConflict: conflicted})
}

func DeleteStory(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteStory(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func Volumes(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().Volumes(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func CreateVolume(ctx fiber.Ctx) error {
	var input storytellerModel.StoryVolumeRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateVolume(authsession.Session(ctx).UserId, ctx.Params("project"), input, webVersionSource(""))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateVolume(ctx fiber.Ctx) error {
	var input storytellerModel.StoryVolumeRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateVolume(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("volume"), input, webVersionSource(""))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func VolumeActivity(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().VolumeActivity(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("volume"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func PresignImageUpload(ctx fiber.Ctx) error {
	var input storytellerModel.ImagePageUploadRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, err := storyteller.NewService().PresignImageUpload(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("project"), input.ContentTypes)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func ImageStoryPages(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().ImageStoryPages(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func PublicImageStoryPages(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PublicImageStoryPages(ctx.Params("project"), ctx.Params("story"), optionalViewerID(ctx))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller image story not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func SharedImageStoryPages(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().SharedImageStoryPages(ctx.Params("token"), ctx.Params("story"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller image story not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func StoryVersions(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().StoryVersions(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func StoryVersion(ctx fiber.Ctx) error {
	versionID, err := parseUint(ctx.Params("version"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().StoryVersion(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), versionID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story version not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func RevertStoryVersion(ctx fiber.Ctx) error {
	versionID, err := parseUint(ctx.Params("version"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().RevertStory(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), versionID, "web_manual")
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story version not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func PublicStoryLatestVersion(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().PublicStoryLatestVersion(ctx.Params("project"), ctx.Params("story"), optionalViewerID(ctx))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func PublicStoryVersions(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PublicStoryVersions(ctx.Params("project"), ctx.Params("story"), optionalViewerID(ctx))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

func ProjectStoryBookmarks(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().ProjectStoryBookmarks(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

// storyBookmarkRequest 同時給文字與圖片書籤用：文字故事帶 version_id + line_id
// （行號的字串形式）；圖片故事（話）只帶 line_id（頁面 id），version_id 可以省略。
type storyBookmarkRequest struct {
	VersionID uint64 `json:"version_id"`
	LineID    string `json:"line_id"`
}

func StoryBookmarks(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().StoryBookmarks(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

func CreateStoryBookmark(ctx fiber.Ctx) error {
	var input storyBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateStoryBookmark(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), input.LineID, input.VersionID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteStoryBookmark(ctx fiber.Ctx) error {
	var input storyBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteStoryBookmark(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), input.LineID, input.VersionID); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func Lores(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().Lores(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

// LoresPage 是 Lores 的分頁版本，只給工作台的設定集列表用（該頁面不需要一次拿全部）；
// LoreEditor／StoryEditor／LoreDiffCompare 那些要完整清單（@lore: 引用選單、版本比較）
// 的地方繼續呼叫不分頁的 Lores，兩邊不互相取代。
func LoresPage(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("per_page", "10"))
	rows, total, err := storyteller.NewService().LoresPage(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Query("collection_id"), page, pageSize)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]any{
		"lores":       rows,
		"total_count": total,
		"page":        page,
		"page_size":   pageSize,
	})
}

func LoreCollections(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().LoreCollections(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func CreateLoreCollection(ctx fiber.Ctx) error {
	var input storytellerModel.LoreCollectionRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateLoreCollection(authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateLoreCollection(ctx fiber.Ctx) error {
	var input storytellerModel.LoreCollectionRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateLoreCollection(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("collection"), input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore collection not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteLoreCollection(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteLoreCollection(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("collection")); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore collection not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func Lore(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().Lore(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func CreateLore(ctx fiber.Ctx) error {
	var input storytellerModel.LoreRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateLore(authsession.Session(ctx).UserId, ctx.Params("project"), input, webVersionSource(input.SaveTrigger))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

// loreUpdateOutput 的 version_conflict 語意跟 storyUpdateOutput 一樣。
type loreUpdateOutput struct {
	storytellerModel.Lore
	VersionConflict bool `json:"version_conflict"`
}

func UpdateLore(ctx fiber.Ctx) error {
	var input storytellerModel.LoreRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, conflicted, err := storyteller.NewService().UpdateLore(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), input, webVersionSource(input.SaveTrigger))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(loreUpdateOutput{Lore: *row, VersionConflict: conflicted})
}

func MoveLore(ctx fiber.Ctx) error {
	var input storytellerModel.LoreMoveRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().MoveLore(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteLore(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteLore(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func LoreVersions(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().LoreVersions(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func LoreVersion(ctx fiber.Ctx) error {
	versionID, err := parseUint(ctx.Params("version"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().LoreVersion(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), versionID)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore version not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func RevertLoreVersion(ctx fiber.Ctx) error {
	versionID, err := parseUint(ctx.Params("version"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().RevertLore(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), versionID, "web_manual")
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore version not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func StoryChatMessages(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("per_page", "10"))
	rows, total, err := storyteller.NewService().StoryChatMessages(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), page, pageSize)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.DBError(err)
	}
	return output.Success(map[string]any{
		"items":    rows,
		"total":    total,
		"page":     page,
		"per_page": pageSize,
	})
}

func LoreChatMessages(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("per_page", "10"))
	rows, total, err := storyteller.NewService().LoreChatMessages(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), page, pageSize)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller lore not found"))
		}
		return output.DBError(err)
	}
	return output.Success(map[string]any{
		"items":    rows,
		"total":    total,
		"page":     page,
		"per_page": pageSize,
	})
}

func FavoriteProjects(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().FavoriteProjects(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func FavoriteAuthors(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().FavoriteAuthors(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func FavoriteStatus(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().FavoriteStatus(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func CreateFavorite(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().CreateFavorite(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteFavorite(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteFavorite(authsession.Session(ctx).UserId, ctx.Params("project")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func AuthorFavoriteStatus(ctx fiber.Ctx) error {
	authorUserID, err := parseUint(ctx.Params("author"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().AuthorFavoriteStatus(authsession.Session(ctx).UserId, authorUserID)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(row)
}

func CreateAuthorFavorite(ctx fiber.Ctx) error {
	authorUserID, err := parseUint(ctx.Params("author"))
	if err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateAuthorFavorite(authsession.Session(ctx).UserId, authorUserID)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteAuthorFavorite(ctx fiber.Ctx) error {
	authorUserID, err := parseUint(ctx.Params("author"))
	if err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteAuthorFavorite(authsession.Session(ctx).UserId, authorUserID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func SetFavoriteProjectVisibility(ctx fiber.Ctx) error {
	var input storytellerModel.FavoriteVisibilityRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().SetFavoriteProjectVisibility(authsession.Session(ctx).UserId, ctx.Params("project"), input.Hidden); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"hidden": input.Hidden})
}

func SetFavoriteAuthorVisibility(ctx fiber.Ctx) error {
	authorUserID, err := parseUint(ctx.Params("author"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.FavoriteVisibilityRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().SetFavoriteAuthorVisibility(authsession.Session(ctx).UserId, authorUserID, input.Hidden); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"hidden": input.Hidden})
}

func RankingStatus(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().RankingStatus(authsession.Session(ctx).UserId, ctx.Params("project"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func SaveRanking(ctx fiber.Ctx) error {
	var input storytellerModel.ProjectRankingRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().SaveRanking(authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteRanking(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteRanking(authsession.Session(ctx).UserId, ctx.Params("project")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

func UserProfile(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().UserProfile(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(row)
}

func SaveUserProfile(ctx fiber.Ctx) error {
	var input storytellerModel.UserProfileRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().SaveUserProfile(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteUserProfile(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteUserProfile(authsession.Session(ctx).UserId); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}

// webVersionSource 把前端帶來的 save_trigger 轉成存進 story/lore version 的 source 標記，
// 讓編輯歷史分得出這個版本是自動存檔還是手動按下存檔（未帶值的舊呼叫端一律當手動）。
func webVersionSource(saveTrigger string) string {
	switch saveTrigger {
	case "auto":
		return "web_auto"
	case "agent_apply":
		return "web_agent_apply"
	default:
		return "web_manual"
	}
}

func parseUint(value string) (uint64, error) {
	id, err := strconv.ParseUint(value, 10, 64)
	if err != nil || id == 0 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}

// parseOptionalUint 給 story_id／lore_id 這種「可以不帶，但帶了就要是合法 id」
// 的 query 參數用，空字串回傳 nil 不算錯誤。
func parseOptionalUint(value string) (*uint64, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	id, err := parseUint(value)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

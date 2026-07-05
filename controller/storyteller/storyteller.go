package storyteller

import (
	"errors"
	"strconv"
	"strings"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	authService "faryne.dev/service/auth"
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
	row, err := storyteller.NewService().PublicProject(ctx.Params("project"))
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
	if err := storyteller.NewService().TestProviderAPIKey(ctx.Context(), authsession.Session(ctx).UserId, id); err != nil {
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
	agentID, err := parseUint(ctx.Query("agent_id"))
	if err != nil {
		return output.BadRequest(err)
	}
	month := ctx.Query("month")
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("per_page", "20"))
	rows, total, err := storyteller.NewService().AgentUsageLogs(authsession.Session(ctx).UserId, providerAPIKeyID, agentID, month, page, pageSize)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("provider api key or agent not found"))
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
	row, err := storyteller.NewService().CreateStory(authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateStory(ctx fiber.Ctx) error {
	var input storytellerModel.StoryRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateStory(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteStory(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteStory(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
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

func PublicStoryLatestVersion(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().PublicStoryLatestVersion(ctx.Params("project"), ctx.Params("story"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller story not found"))
		}
		return output.DBError(err)
	}
	return output.Success(row)
}

func PublicStoryVersions(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PublicStoryVersions(ctx.Params("project"), ctx.Params("story"))
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

type storyBookmarkRequest struct {
	VersionID uint64 `json:"version_id"`
	LineIndex int    `json:"line_index"`
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
	row, err := storyteller.NewService().CreateStoryBookmark(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), input.VersionID, input.LineIndex)
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
	if err := storyteller.NewService().DeleteStoryBookmark(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("story"), input.VersionID, input.LineIndex); err != nil {
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
	row, err := storyteller.NewService().CreateLore(authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateLore(ctx fiber.Ctx) error {
	var input storytellerModel.LoreRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateLore(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("lore"), input)
	if err != nil {
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

func parseUint(value string) (uint64, error) {
	id, err := strconv.ParseUint(value, 10, 64)
	if err != nil || id == 0 {
		return 0, errors.New("invalid id")
	}
	return id, nil
}

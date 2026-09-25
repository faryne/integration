package storyteller

import (
	"errors"
	"strconv"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// AssistantMemories 只提供目前作用域的有效記憶；記憶管理 UI 與寫入 API 等確認
// 寫入策略後再另外開，不讓這個唯讀入口意外承擔修改語意。
func AssistantMemories(ctx fiber.Ctx) error {
	limit, _ := strconv.Atoi(ctx.Query("limit"))
	rows, err := storytellerService.NewService().AssistantMemories(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Query("story_public_id"),
		ctx.Query("lore_public_id"),
		limit,
	)
	if err != nil {
		if errors.Is(err, storytellerService.ErrAssistantMemoryTargetInvalid) {
			return output.BadRequest(err)
		}
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller memory scope not found"))
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}

func assistantMemoryMutationError(err error, notFoundMessage string) error {
	switch {
	case errors.Is(err, storytellerService.ErrAgenticQueryServerDraining):
		return output.Maintenance("伺服器正在重啟，請稍後再試。", nil)
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New(notFoundMessage))
	case errors.Is(err, storytellerService.ErrAssistantMemoryChatNotCompleted),
		errors.Is(err, storytellerService.ErrAssistantMemoryDraftNotReady),
		errors.Is(err, storytellerService.ErrAssistantMemoryDraftEmpty),
		errors.Is(err, storytellerService.ErrAssistantMemoryScopeInvalid),
		errors.Is(err, storytellerService.ErrAssistantMemoryKindInvalid),
		errors.Is(err, storytellerService.ErrAssistantMemoryNameTooLong),
		errors.Is(err, storytellerService.ErrAssistantMemoryContentInvalid),
		errors.Is(err, storytellerService.ErrAssistantMemoryPriorityInvalid),
		errors.Is(err, storytellerService.ErrAssistantMemoryDraftResolved),
		errors.Is(err, storytellerService.ErrAssistantMemoryProviderRequired),
		errors.Is(err, storytellerService.ErrAssistantMemoryModelRequired):
		return output.BadRequest(err)
	case errors.Is(err, storytellerService.ErrAIProviderUnsupported),
		errors.Is(err, storytellerService.ErrAIProviderMissingEndpoint):
		return output.BadRequest(err)
	default:
		return output.DBError(err)
	}
}

// GenerateAssistantMemoryDraft 只建立候選並啟動背景整理，不會直接寫成有效記憶。
func GenerateAssistantMemoryDraft(ctx fiber.Ctx) error {
	chatID, err := parseUint(ctx.Params("chat"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AssistantMemoryGenerateRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storytellerService.NewService().GenerateAssistantMemory(authsession.Session(ctx).UserId, chatID, input)
	if err != nil {
		return assistantMemoryMutationError(err, "storyteller chat, target, or provider key not found")
	}
	return output.Success(row)
}

// AssistantMemoryDraft 供前端輪詢非同步整理狀態；只有建立草稿的使用者可讀。
func AssistantMemoryDraft(ctx fiber.Ctx) error {
	row, err := storytellerService.NewService().AssistantMemoryDraft(authsession.Session(ctx).UserId, ctx.Params("memory"))
	if err != nil {
		return assistantMemoryMutationError(err, "storyteller memory draft not found")
	}
	return output.Success(row)
}

// ConfirmAssistantMemoryDraft 是唯一讓候選變成有效記憶的入口。
func ConfirmAssistantMemoryDraft(ctx fiber.Ctx) error {
	var input storytellerModel.AssistantMemoryConfirmRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storytellerService.NewService().ConfirmAssistantMemory(authsession.Session(ctx).UserId, ctx.Params("memory"), input)
	if err != nil {
		return assistantMemoryMutationError(err, "storyteller memory draft or target not found")
	}
	return output.Success(row)
}

// DeleteAssistantMemoryDraft 丟棄尚未確認的候選；已確認記憶不可從這個端點刪除。
func DeleteAssistantMemoryDraft(ctx fiber.Ctx) error {
	err := storytellerService.NewService().DeleteAssistantMemoryDraft(authsession.Session(ctx).UserId, ctx.Params("memory"))
	if err != nil {
		return assistantMemoryMutationError(err, "storyteller memory draft not found")
	}
	return output.Success(map[string]bool{"deleted": true})
}

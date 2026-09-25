package storyteller

import (
	"errors"
	"strconv"

	"faryne.dev/middleware/authsession"
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

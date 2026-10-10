package storyteller

import (
	"errors"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// 讀者檢舉。理由列表公開（檢舉 dialog 開啟時抓），送出檢舉需登入。

// ModerationReasons 回傳某種對象可選的檢舉理由（?target_type=comment 等，留空回全部）。
func ModerationReasons(ctx fiber.Ctx) error {
	reasons, err := storyteller.NewService().ModerationReasons(storytellerModel.ReportTargetType(ctx.Query("target_type")))
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(reasons)
}

func CreateReport(ctx fiber.Ctx) error {
	var input storytellerModel.ReportRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	err := storyteller.NewService().CreateReport(sessionUserID(ctx), input)
	// 找不到目標用檢舉專屬的訊息，其餘（輸入錯誤 400 等）沿用動態／留言的錯誤轉換
	if repository.IsRecordNotFound(err) {
		return output.NotFound(errors.New("找不到要檢舉的內容"))
	}
	return authorPostResponse(nil, err)
}

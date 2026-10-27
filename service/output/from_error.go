package output

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

// FromError 把 service／repository 回來的錯誤統一轉成 API 回應，controller 不用再各自
// 寫一串 if repository.IsRecordNotFound(err) {...}：
//   - 已經是 output 回應（service 自己決定好狀態碼）→ 原樣回傳
//   - 找不到資料 → 404
//   - 重複鍵、外鍵限制 → 409（需 gorm.Config 開 TranslateError，見 service/client/mysql.go）
//   - 其他 → 400，維持既有大多數 controller 的行為；service 的驗證錯誤目前多半是
//     errors.New("...")，跟真正的 DB 故障分不開，等驗證錯誤改用 sentinel／自訂型別後再把這裡改成 500。
//
// 需要自訂訊息或功能專屬狀態碼（例如通知的 409002）的地方，先自行判斷，最後一個分支再交給 FromError。
func FromError(err error) error {
	var out CommonOutputInterface
	switch {
	case errors.As(err, &out):
		return out
	case errors.Is(err, gorm.ErrRecordNotFound):
		return NotFound(err)
	case errors.Is(err, gorm.ErrDuplicatedKey), errors.Is(err, gorm.ErrForeignKeyViolated):
		return New(fiber.StatusConflict, CustomCodeConflict, nil, err.Error())
	default:
		return BadRequest(err)
	}
}

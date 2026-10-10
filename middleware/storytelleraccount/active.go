package storytelleraccount

import (
	"errors"

	"faryne.dev/middleware/authsession"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// CustomCodeAccountSuspended 是帳號被站方停權；回 401 讓前端走既有的「重建 session」流程，
// 重建時登入端點同樣會擋下，前端最後清掉 session。
const CustomCodeAccountSuspended output.CustomCode = "401201"

// Suspended 是停權的統一回應（session 與 bearer 共用）。
func Suspended() error {
	return output.New(fiber.StatusUnauthorized, CustomCodeAccountSuspended, nil, storytellerService.ErrAccountSuspended.Error())
}

// Active 掛在 authsession.New 之後：每次請求都確認帳號沒有被停權（PK 查詢、走 primary），
// session 存在 Redis 但沒有依使用者建索引，用「每次檢查」取代逐一刪 session。
func Active() fiber.Handler {
	service := storytellerService.NewService()
	return func(ctx fiber.Ctx) error {
		session := authsession.Session(ctx)
		if session == nil {
			return ctx.Next()
		}
		if err := service.EnsureAccountActive(session.UserId); err != nil {
			if errors.Is(err, storytellerService.ErrAccountSuspended) {
				return Suspended()
			}
			return output.DBError(err)
		}
		return ctx.Next()
	}
}

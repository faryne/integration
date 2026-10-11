// Package storytellerclient 是給 SteamLoom Writer 等原生 app 呼叫的 REST API：
// 身分來自 storytellerbearer（OAuth access token 或 PAT），不是網頁的 X-Encrypt-Key session，
// 所以不能直接沿用 controller/storyteller 裡讀 authsession 的 handler，這裡只做身分來源的轉接。
package storytellerclient

import (
	"faryne.dev/middleware/storytellerbearer"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// Me 回傳登入者的作者資料（筆名、頭像），格式同網頁的 GET /storyteller/user。
func Me(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().UserProfile(storytellerbearer.UserID(ctx))
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(row)
}

// Projects 回傳登入者的創作專案列表，格式同網頁的 GET /storyteller/projects。
func Projects(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().Projects(storytellerbearer.UserID(ctx))
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

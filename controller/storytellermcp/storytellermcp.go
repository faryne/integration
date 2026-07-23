package storytellermcp

import (
	"context"
	"net/http"
	"time"

	"faryne.dev/middleware/storytellerpat"
	serviceMCP "faryne.dev/service/mcp"
	"github.com/gofiber/fiber/v3"
)

const requestTimeout = 30 * time.Second

var server = serviceMCP.NewStorytellerServer("steamloom.works", "http")

// Handle 只服務通過 storytellerpat middleware 驗證的請求，跟公開的 /mcp 用不同的
// server 實例與 tool set，避免把寫作用的 CRUD 工具和 av/nekomaid 混在一起回給
// tools/list。
func Handle(ctx fiber.Ctx) error {
	userID := storytellerpat.UserID(ctx)
	source := "mcp:" + storytellerpat.TokenLabel(ctx)
	baseCtx := serviceMCP.WithStorytellerSource(
		serviceMCP.WithStorytellerUserID(context.Background(), userID),
		source,
	)
	requestCtx, cancel := context.WithTimeout(baseCtx, requestTimeout)
	defer cancel()

	resp, shouldReply, err := server.HandleJSONRPC(requestCtx, ctx.Body())
	if err != nil {
		return err
	}
	if !shouldReply {
		return ctx.SendStatus(http.StatusNoContent)
	}
	return ctx.JSON(resp)
}

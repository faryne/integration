package mcp

import (
	"context"
	"net/http"
	"time"

	serviceMCP "faryne.dev/service/mcp"
	"github.com/gofiber/fiber/v3"
)

const requestTimeout = 30 * time.Second

var server = serviceMCP.NewServer("faryne.dev", "http")

func Handle(ctx fiber.Ctx) error {
	// 帶上呼叫端 IP：女優上稿等工具要依 IP 限流
	requestCtx, cancel := context.WithTimeout(serviceMCP.WithClientIP(context.Background(), ctx.IP()), requestTimeout)
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

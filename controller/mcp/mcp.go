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
	requestCtx, cancel := context.WithTimeout(context.Background(), requestTimeout)
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

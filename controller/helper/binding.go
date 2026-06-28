package helper

import (
	"github.com/gofiber/fiber/v3"

	"faryne.dev/service/output"
)

// BindQuery 綁定查詢參數
func BindQuery[T any](ctx fiber.Ctx, req *T) error {
	if err := ctx.Bind().Query(req); err != nil {
		return output.BadRequest(err)
	}
	return nil
}

// BindJSON 綁定 JSON 請求體
func BindJSON[T any](ctx fiber.Ctx, req *T) error {
	if err := ctx.Bind().JSON(req); err != nil {
		return output.BadRequest(err)
	}
	return nil
}

// BindForm 綁定表單資料
func BindForm[T any](ctx fiber.Ctx, req *T) error {
	if err := ctx.Bind().Form(req); err != nil {
		return output.BadRequest(err)
	}
	return nil
}

// BindParams 綁定路徑參數
func BindParams[T any](ctx fiber.Ctx, req *T) error {
	if err := ctx.Bind().URI(req); err != nil {
		return output.BadRequest(err)
	}
	return nil
}

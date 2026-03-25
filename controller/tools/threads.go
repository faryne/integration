package tools

import (
	"faryne.dev/model/entity/tools"
	"faryne.dev/service/output"
	"faryne.dev/service/thread"
	"github.com/gofiber/fiber/v3"
)

func ThreadCapture(ctx fiber.Ctx) error {
	var q tools.ThreadsCaptureRequest
	if err := ctx.Bind().Body(&q); err != nil {
		return output.BadRequest(err)
	}
	img, err := thread.OEmbedCapture(q.Url)
	if err != nil {
		return output.InternalServiceError(err)
	}
	return output.Success(map[string]string{
		"img": img,
	})
}

package tools

import (
	"faryne.dev/model/entity/tools"
	"faryne.dev/service/output"
	"faryne.dev/service/thread"
	"github.com/gofiber/fiber/v3"
)

// ThreadCapture captures a Threads oEmbed image.
// @Summary Capture Threads oEmbed
// @Tags Tools
// @Accept json
// @Produce json
// @Param request body tools.ThreadsCaptureRequest true "Threads capture request"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /tools/threads/oembed_capture [post]
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

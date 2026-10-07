package nekomaid

import (
	"errors"

	nekomaidRetrieve "faryne.dev/service/nekomaid/retrieve"
	"github.com/gofiber/fiber/v3"
)

// Retrieve retrieves and stores an artwork.
// @Summary Retrieve nekomaid artwork
// @Tags Nekomaid
// @Produce json
// @Param site query string true "Site, for example pixiv, nico, tinami"
// @Param artwork_id query string true "Artwork ID"
// @Success 201 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /nekomaid/retrieve.json [get]
// @Router /nekomaid/retrieve.json [post]
func Retrieve(ctx fiber.Ctx) error {
	var siteStr, artworkId string
	if ctx.Method() == fiber.MethodPost {
		siteStr = ctx.FormValue("site")
		artworkId = ctx.FormValue("artwork_id")
	} else {
		siteStr = ctx.Query("site")
		artworkId = ctx.Query("artwork_id")
	}

	if siteStr == "" || artworkId == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "site and artwork_id are required",
		})
	}

	result, err := nekomaidRetrieve.Artwork(ctx.Context(), siteStr, artworkId)
	if err != nil {
		status := fiber.StatusInternalServerError
		if errors.Is(err, nekomaidRetrieve.ErrArguments) || errors.Is(err, nekomaidRetrieve.ErrUnsupportedSite) {
			status = fiber.StatusBadRequest
		} else if err.Error() == "此作品已被抓取過" {
			status = fiber.StatusAlreadyReported
		} else if err.Error() == "此畫師的作品不允許被抓取" {
			status = fiber.StatusForbidden
		}

		return ctx.Status(status).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	status := fiber.StatusCreated
	if result.Status == "queued" {
		status = fiber.StatusAccepted
	}
	return ctx.Status(status).JSON(fiber.Map{"url": result.URL})
}

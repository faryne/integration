package nekomaid

import (
	nekomaidService "faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// Search searches indexed nekomaid artworks.
// @Summary Search nekomaid artworks
// @Tags Nekomaid
// @Produce json
// @Param site path string false "Site"
// @Param authorId path string false "Author ID"
// @Param artworkId path string false "Artwork ID"
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /nekomaid/search/{site}/{authorId}/{artworkId} [get]
func Search(ctx fiber.Ctx) error {
	response, err := nekomaidService.Search(ctx)
	if err != nil {
		return output.ESError(err)
	}
	return ctx.JSON(response)
}

package nekomaid

import (
	"errors"

	nekomaidService "faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// Artwork returns one indexed artwork and related recommendations.
// @Summary Get a nekomaid artwork
// @Tags Nekomaid
// @Produce json
// @Param site path string true "Site"
// @Param authorId path string true "Author ID"
// @Param artworkId path string true "Artwork ID"
// @Success 200 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/nekomaid/{site}/{authorId}/{artworkId} [get]
func Artwork(ctx fiber.Ctx) error {
	response, err := nekomaidService.GetArtworkDetail(
		ctx.Params("site"),
		ctx.Params("authorId"),
		ctx.Params("artworkId"),
	)
	if errors.Is(err, nekomaidService.ErrArtworkNotFound) {
		return output.NotFound(err)
	}
	if err != nil {
		return output.InternalServiceError(err)
	}
	return output.Success(response)
}

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
	return output.Success(response)
}

// SearchRSS searches indexed nekomaid artworks and renders RSS.
// @Summary Search nekomaid artworks as RSS
// @Tags Nekomaid
// @Produce xml
// @Param site path string false "Site"
// @Param authorId path string false "Author ID"
// @Param artworkId path string false "Artwork ID"
// @Success 200 {string} string
// @Failure 500 {object} output.CommonOutput
// @Router /nekomaid/search.rss/{site}/{authorId}/{artworkId} [get]
func SearchRSS(ctx fiber.Ctx) error {
	response, err := nekomaidService.SearchRSS(ctx)
	if err != nil {
		return output.ESError(err)
	}
	ctx.Set(fiber.HeaderContentType, "application/rss+xml; charset=utf-8")
	return ctx.SendString(response)
}

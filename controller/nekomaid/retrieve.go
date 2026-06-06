package nekomaid

import (
	"context"

	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	"faryne.dev/service/nekomaid"
	"faryne.dev/service/nekomaid/nico"
	"faryne.dev/service/nekomaid/pixiv"
	"faryne.dev/service/nekomaid/tinami"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

type asyncPreviewRetriever interface {
	GetPreview(id string) (previewURL string, async bool, err error)
}

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

	site := enum.NekomaidSite(siteStr)

	if site == "" || artworkId == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "site and artwork_id are required",
		})
	}

	var retriever nekomaid.RetrieverInterface
	switch site {
	case enum.NekomaidSitePixiv:
		retriever = pixiv.New()
	case enum.NekomaidSiteNico:
		retriever = nico.New()
	case enum.NekomaidSiteTinami:
		retriever = tinami.New()
	default:
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported site",
		})
	}

	r := nekomaid.NewRetriever()
	if previewer, ok := retriever.(asyncPreviewRetriever); ok {
		previewURL, runAsync, err := previewer.GetPreview(artworkId)
		if err != nil {
			return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		if runAsync {
			retrieveInBackground(r, site, artworkId, retriever)
			return ctx.Status(fiber.StatusAccepted).JSON(fiber.Map{
				"url": previewURL,
			})
		}
	}

	previewUrl, err := r.RetrieveAndSave(ctx.Context(), site, artworkId, retriever)
	if err != nil {
		// 根據錯誤訊息判斷狀態碼 (這部分可以再細分自定義錯誤類型)
		status := fiber.StatusInternalServerError
		if err.Error() == "此作品已被抓取過" {
			status = fiber.StatusAlreadyReported
		} else if err.Error() == "此畫師的作品不允許被抓取" {
			status = fiber.StatusForbidden
		}

		return ctx.Status(status).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return ctx.Status(fiber.StatusCreated).JSON(fiber.Map{
		"url": previewUrl,
	})
}

func retrieveInBackground(r *nekomaid.Retriever, site enum.NekomaidSite, artworkId string, retriever nekomaid.RetrieverInterface) {
	go func(site enum.NekomaidSite, artworkId string, retriever nekomaid.RetrieverInterface) {
		previewUrl, err := r.RetrieveAndSave(context.Background(), site, artworkId, retriever)
		if err != nil {
			log.Logger().Warn("Nekomaid async retrieve failed",
				zap.String("site", string(site)),
				zap.String("artwork_id", artworkId),
				zap.Error(err),
			)
			return
		}
		log.Logger().Info("Nekomaid async retrieve completed",
			zap.String("site", string(site)),
			zap.String("artwork_id", artworkId),
			zap.String("preview_url", previewUrl),
		)
	}(site, artworkId, retriever)
}

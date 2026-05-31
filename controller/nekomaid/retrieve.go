package nekomaid

import (
	"faryne.dev/model/enum"
	"faryne.dev/service/nekomaid"
	"faryne.dev/service/nekomaid/nico"
	"faryne.dev/service/nekomaid/pixiv"
	"faryne.dev/service/nekomaid/tinami"
	"github.com/gofiber/fiber/v3"
)

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
	previewUrl, err := r.RetrieveAndSave(ctx.Context(), site, artworkId, retriever)
	if err != nil {
		// 根據錯誤訊息判斷狀態碼 (這部分可以再細分自定義錯誤類型)
		status := fiber.StatusInternalServerError
		if err.Error() == "此作品已被抓取過" {
			status = fiber.StatusConflict
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

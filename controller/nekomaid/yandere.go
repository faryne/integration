package nekomaid

import (
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/repository/yandere_tags"
	"faryne.dev/service/helper"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
	"net/url"
)

func YandereTags(ctx fiber.Ctx) error {
	tagsResponse, tagsResponseError := helper.Paginate(ctx, func(page int64, perPage int64, params url.Values) (helper.PaginateCallbackResponse[[]nekomaid.YandereTagOutput], error) {
		rows, total, err := yandere_tags.FetchTags(page, perPage)
		return helper.PaginateCallbackResponse[[]nekomaid.YandereTagOutput]{
			Data:  rows,
			Total: total,
		}, err
	})
	if tagsResponseError != nil {
		return output.DBError(tagsResponseError)
	}
	return output.New(fiber.StatusOK, output.CustomCodeSuccess, tagsResponse)
}

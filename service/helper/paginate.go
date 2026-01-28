package helper

import (
	"faryne.dev/model/entity"
	"github.com/gofiber/fiber/v3"
	"math"
	"net/url"
	"strconv"
)

type PaginateCallbackResponse[T any] struct {
	Data  T
	Total int64
}
type PaginateCallback[T any] func(page int64, perPage int64, params url.Values) (PaginateCallbackResponse[T], error)

func Paginate[T any](ctx fiber.Ctx, cb PaginateCallback[T]) (*entity.CommonPaginationOutput[T], error) {
	currentPage, _ := strconv.ParseInt(ctx.Query("page", "1"), 10, 64)
	perPage, _ := strconv.ParseInt(ctx.Query("per_page", "30"), 10, 64)
	fullPath := ctx.Scheme() + "://" + ctx.Hostname() + ctx.Path()
	rawQuery := ctx.Queries()
	values := url.Values{}
	for k, v := range rawQuery {
		values.Add(k, v)
	}

	resp, err := cb(currentPage, perPage, values)
	if err != nil {
		return nil, err
	}

	lastPage := int64(math.Ceil(float64(resp.Total) / float64(perPage)))

	return &entity.CommonPaginationOutput[T]{
		Data:        resp.Data,
		CurrentPage: currentPage,

		FirstPageUrl: generatePageUrl(fullPath, values, 1, perPage),
		LastPageUrl:  generatePageUrl(fullPath, values, lastPage, perPage),
		PrevPageUrl:  generatePageUrl(fullPath, values, currentPage-1, perPage),
		NextPageUrl:  generatePageUrl(fullPath, values, currentPage+1, perPage),

		PerPage: perPage,

		From: (currentPage-1)*perPage + 1,
		To:   currentPage * perPage,

		LastPage: lastPage,
		Path:     fullPath,
		Total:    resp.Total,
	}, nil
}

func ResultPaginate[T any](ctx fiber.Ctx, input T, total int64) *entity.CommonPaginationOutput[T] {
	currentPage, currentPageError := strconv.ParseInt(ctx.Query("page", "1"), 10, 64)
	if currentPageError != nil {
		currentPage = 1
	}
	perPage, perPageError := strconv.ParseInt(ctx.Query("per_page", "30"), 10, 64)
	if perPageError != nil {
		perPage = 30
	}
	lastPage := int64(math.Ceil(float64(total) / float64(perPage)))

	fullPath := ctx.Scheme() + "://" + ctx.Hostname() + ctx.Path()
	rawQuery := ctx.Queries()
	values := url.Values{}
	for k, v := range rawQuery {
		values.Add(k, v)
	}

	return &entity.CommonPaginationOutput[T]{
		Data:        input,
		CurrentPage: currentPage,

		FirstPageUrl: generatePageUrl(fullPath, values, 1, perPage),
		LastPageUrl:  generatePageUrl(fullPath, values, lastPage, perPage),
		PrevPageUrl:  generatePageUrl(fullPath, values, currentPage-1, perPage),
		NextPageUrl:  generatePageUrl(fullPath, values, currentPage+1, perPage),

		PerPage: perPage,

		From: (currentPage-1)*perPage + 1,
		To:   currentPage * perPage,

		LastPage: lastPage,
		Path:     fullPath,
		Total:    total,
	}
}

func generatePageUrl(fullPath string, params url.Values, page int64, perPage int64) string {
	if page <= 1 {
		return fullPath + "?" + params.Encode()
	}
	if params.Has("page") {
		params.Set("page", strconv.FormatInt(page, 10))
	} else {
		params.Add("page", strconv.FormatInt(page, 10))
	}
	if params.Has("per_page") {
		params.Set("per_page", strconv.FormatInt(perPage, 10))
	} else {
		params.Add("per_page", strconv.FormatInt(perPage, 10))
	}

	return fullPath + "?" + params.Encode()
}

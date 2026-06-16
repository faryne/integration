package helper

import (
	"encoding/base64"
	"encoding/json"
	"math"
	"net/url"
	"strconv"

	"faryne.dev/model/entity"
	"github.com/gofiber/fiber/v3"
)

type PaginateCallbackResponse[T any] struct {
	Data  T
	Total int64
}
type PaginateCallback[T any] func(page int64, perPage int64, params url.Values) (PaginateCallbackResponse[T], error)

type ESCursor struct {
	SearchAfter []any `json:"search_after"`
	Offset      int64 `json:"offset"`
}

type ESPaginateInput[T any] struct {
	Data            T
	Total           int64
	PerPage         int64
	CurrentCursor   string
	CurrentOffset   int64
	NextSearchAfter []any
	RowsCount       int64
}

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

func DecodeESCursor(value string) (*ESCursor, error) {
	if value == "" {
		return nil, nil
	}
	payload, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, err
	}
	var cursor ESCursor
	if err := json.Unmarshal(payload, &cursor); err != nil {
		return nil, err
	}
	return &cursor, nil
}

func EncodeESCursor(cursor ESCursor) (string, error) {
	payload, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

func PaginateByES[T any](ctx fiber.Ctx, input ESPaginateInput[T]) (*entity.CommonESPaginationOutput[T], error) {
	perPage := input.PerPage
	if perPage <= 0 {
		perPage = 30
	}
	rowsCount := input.RowsCount
	if rowsCount < 0 {
		rowsCount = 0
	}
	nextCursor := ""
	if rowsCount > 0 && len(input.NextSearchAfter) > 0 && input.CurrentOffset+rowsCount < input.Total {
		encoded, err := EncodeESCursor(ESCursor{
			SearchAfter: input.NextSearchAfter,
			Offset:      input.CurrentOffset + rowsCount,
		})
		if err != nil {
			return nil, err
		}
		nextCursor = encoded
	}

	from := int64(0)
	to := int64(0)
	if rowsCount > 0 {
		from = input.CurrentOffset + 1
		to = input.CurrentOffset + rowsCount
	}

	fullPath := ctx.Scheme() + "://" + ctx.Hostname() + ctx.Path()

	return &entity.CommonESPaginationOutput[T]{
		Data:          input.Data,
		Path:          fullPath,
		PerPage:       perPage,
		From:          from,
		To:            to,
		Total:         input.Total,
		CurrentCursor: input.CurrentCursor,
		NextCursor:    nextCursor,
		HasNext:       nextCursor != "",
	}, nil
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

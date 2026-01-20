package nekomaid

import (
	"faryne.dev/model/entity"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/service/search"
	"fmt"
	"github.com/gofiber/fiber/v3"
	"reflect"
	"strconv"
)

var f = func(input nekomaid.ArtworkSearchResult) nekomaid.ArtworkSearchClearRow {
	var authorId string
	switch reflect.ValueOf(input.AuthorId).Kind() {
	case reflect.Float64:
		authorId = strconv.FormatFloat(input.AuthorId.(float64), 'f', -1, 64)
	case reflect.String:
		authorId = input.AuthorId.(string)
	case reflect.Int64:
		authorId = strconv.FormatInt(input.AuthorId.(int64), 10)
	default:
		panic("unhandled default case")
	}
	o := nekomaid.ArtworkSearchClearRow{
		ArtworkId:    input.ArtworkId,
		AuthorId:     authorId,
		From:         input.From,
		Photos:       input.Photos,
		Title:        input.Title,
		Type:         input.Type,
		Thumb:        input.Thumb,
		Gif:          input.Gif == 1,
		PhotosCnt:    len(input.Photos),
		PublishedDt:  input.PublishedDt,
		Tags:         input.Tags,
		NekomaidLink: fmt.Sprintf("https://nekomaid.web.app/#/%s/%s/%s", input.From, authorId, input.ArtworkId),
	}

	return o
}

func Search(ctx fiber.Ctx) (*entity.ElasticSearchResponse[nekomaid.ArtworkSearchResult], []nekomaid.ArtworkSearchClearRow, error) {
	site := ctx.Params("site", "")
	page, pageError := strconv.Atoi(ctx.Query("page", "1"))
	if pageError != nil {
		page = 1
	}
	authorId := ctx.Params("authorId", "")
	artworkId := ctx.Params("artworkId", "")
	tag := ctx.Query("tag", "")
	rating := ctx.Query("rating", "")
	t := ctx.Query("type", "illust")

	q := map[string]any{
		"size": 30,
		"from": (page - 1) * 30,
		"sort": map[string]any{"published_dt": map[string]any{"order": "desc"}},
	}
	if site != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"from": site}}, true, q)
	}
	if authorId != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"author_id": authorId}}, true, q)
	}
	if artworkId != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"artwork_id": artworkId}}, true, q)
	}
	if tag != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"tags.keyword": tag}}, true, q)
		search.SetQuery(map[string]any{"match": map[string]any{"title.keyword": tag}}, false, q)
	}
	if rating != "" {
		switch rating {
		case "2": // 全年齡向
			search.SetQuery(map[string]any{"match": map[string]any{"r18": false}}, true, q)
		case "3": // r18
			search.SetQuery(map[string]any{"match": map[string]any{"r18": true}}, true, q)
		default: // 不分級

		}
	}
	if t != "" {
		switch t {
		case "illust":
			search.SetQuery(map[string]any{"match": map[string]any{"photos_cnt": 1}}, true, q)
			search.SetQuery(map[string]any{"match": map[string]any{"gif": 0}}, true, q)
		case "manga":
			search.SetQuery(map[string]any{"match": map[string]any{"range": map[string]any{"photos_cnt": map[string]any{"gte": 2}}}}, true, q)
			search.SetQuery(map[string]any{"match": map[string]any{"gif": 0}}, true, q)
		}
	}
	if _, ok := q["aggregations"]; !ok {
		q["aggregations"] = map[string]any{
			"tags": map[string]any{
				"significant_terms": map[string]any{
					"field": "tags.keyword",
					"size":  20,
				},
			},
		}
	}
	rawResponse, cleaned, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow]("nekomaid", q, f)
	if err != nil {
		return nil, nil, err
	}
	return rawResponse, cleaned, nil
}

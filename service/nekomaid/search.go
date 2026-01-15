package nekomaid

import (
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

func _setQuery(q map[string]any, mustOrShould bool, conditions map[string]any) {
	// 確保 conditions["query"] 被初始化為 map[string]any
	if _, ok := conditions["query"]; !ok {
		conditions["query"] = map[string]any{}
	}

	// 確保 conditions["query"]["bool"] 被初始化為 map[string]any
	queryMap := conditions["query"].(map[string]any)
	if _, ok := queryMap["bool"]; !ok {
		queryMap["bool"] = map[string]any{}
	}

	boolMap := queryMap["bool"].(map[string]any)
	if mustOrShould {
		if _, ok := boolMap["must"]; !ok {
			boolMap["must"] = make([]map[string]any, 0)
		}

		// 將新的條件添加到 must 陣列中
		mustSlice := boolMap["must"].([]map[string]any)
		boolMap["must"] = append(mustSlice, q)
	} else {
		if _, ok := boolMap["should"]; !ok {
			boolMap["should"] = make([]map[string]any, 0)
		}

		// 將新的條件添加到 must 陣列中
		shouldSlice := boolMap["should"].([]map[string]any)
		boolMap["should"] = append(shouldSlice, q)
	}
}

func Search(ctx fiber.Ctx) ([]nekomaid.ArtworkSearchClearRow, error) {
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
		_setQuery(map[string]any{"match": map[string]any{"from": site}}, true, q)
	}
	if authorId != "" {
		_setQuery(map[string]any{"match": map[string]any{"author_id": authorId}}, true, q)
	}
	if artworkId != "" {
		_setQuery(map[string]any{"match": map[string]any{"artwork_id": artworkId}}, true, q)
	}
	if tag != "" {
		_setQuery(map[string]any{"match": map[string]any{"tags.keyword": tag}}, true, q)
		_setQuery(map[string]any{"match": map[string]any{"title.keyword": tag}}, false, q)
	}
	if rating != "" {
		switch rating {
		case "2": // 全年齡向
			_setQuery(map[string]any{"match": map[string]any{"r18": false}}, true, q)
		case "3": // r18
			_setQuery(map[string]any{"match": map[string]any{"r18": true}}, true, q)
		default: // 不分級

		}
	}
	if t != "" {
		switch t {
		case "illust":
			_setQuery(map[string]any{"match": map[string]any{"photos_cnt": 1}}, true, q)
			_setQuery(map[string]any{"match": map[string]any{"gif": 0}}, true, q)
		case "manga":
			_setQuery(map[string]any{"match": map[string]any{"range": map[string]any{"photos_cnt": map[string]any{"gte": 2}}}}, true, q)
			_setQuery(map[string]any{"match": map[string]any{"gif": 0}}, true, q)
		}
	}
	_, cleaned, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow]("nekomaid", q, f)
	if err != nil {
		return nil, err
	}
	return cleaned, nil
}

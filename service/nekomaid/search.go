package nekomaid

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"faryne.dev/model/entity"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/helper"
	"faryne.dev/service/search"
	"github.com/gofiber/fiber/v3"
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
		IsAnimated:   input.Gif == 1 || input.Type == "ugoira",
		PhotosCnt:    input.PhotosCnt,
		PublishedDt:  input.PublishedDt,
		R18:          input.R18,
		IsR18:        input.R18,
		Tags:         input.Tags,
		NekomaidLink: fmt.Sprintf("%s/nekomaid/%s/%s/%s", Home, input.From, authorId, input.ArtworkId),
	}
	if o.PhotosCnt == 0 {
		o.PhotosCnt = len(input.Photos)
	}

	return o
}

const searchPageSize = 30

type SearchRequest struct {
	Site      string
	Sites     string
	Page      int
	AuthorId  string
	ArtworkId string
	Tag       string
	Rating    string
	Type      string
	Wallpaper string
	MinWidth  string
	Cursor    string
}

func Search(ctx fiber.Ctx) (*nekomaid.ArtworkSearchResponse, error) {
	req := SearchRequest{
		Site:      ctx.Params("site", ""),
		Sites:     ctx.Query("sites", ""),
		Page:      searchPage(ctx),
		AuthorId:  ctx.Params("authorId", ""),
		ArtworkId: ctx.Params("artworkId", ""),
		Tag:       ctx.Query("tag", ""),
		Rating:    ctx.Query("rating", ""),
		Type:      ctx.Query("type", ""),
		Wallpaper: ctx.Query("wallpaper", ""),
		MinWidth:  ctx.Query("min_width", ""),
		Cursor:    ctx.Query("cursor", ""),
	}
	return searchByRequest(req, ctx.Scheme()+"://"+ctx.Hostname()+ctx.Path())
}

func SearchByRequest(req SearchRequest) (*nekomaid.ArtworkSearchResponse, error) {
	return searchByRequest(req, "")
}

func searchByRequest(req SearchRequest, path string) (*nekomaid.ArtworkSearchResponse, error) {
	site := strings.TrimSpace(req.Site)
	sites := strings.TrimSpace(req.Sites)
	page := req.Page
	if page <= 0 {
		page = 1
	}
	authorId := strings.TrimSpace(req.AuthorId)
	artworkId := strings.TrimSpace(req.ArtworkId)
	tag := strings.TrimSpace(req.Tag)
	rating := strings.TrimSpace(req.Rating)
	t := strings.TrimSpace(req.Type)
	wallpaper := strings.TrimSpace(req.Wallpaper)
	minWidth := strings.TrimSpace(req.MinWidth)
	cursorValue := strings.TrimSpace(req.Cursor)
	currentOffset := int64((page - 1) * searchPageSize)

	q := map[string]any{
		"size": searchPageSize,
		"sort": nekomaidDefaultSort(),
	}
	if cursorValue == "" {
		q["from"] = currentOffset
	} else {
		cursor, err := helper.DecodeESCursor(cursorValue)
		if err != nil {
			return nil, fmt.Errorf("cursor is invalid")
		}
		if cursor != nil {
			q["search_after"] = cursor.SearchAfter
			currentOffset = cursor.Offset
		}
	}
	if site != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"from": site}}, true, q)
	} else if sites != "" {
		siteValues := splitCSV(sites)
		if len(siteValues) == 1 {
			search.SetQuery(map[string]any{"match": map[string]any{"from": siteValues[0]}}, true, q)
		} else if len(siteValues) > 1 {
			search.SetQuery(map[string]any{"terms": map[string]any{"from": siteValues}}, true, q)
		}
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
		case "2":
			search.SetQuery(map[string]any{"match": map[string]any{"r18": false}}, true, q)
		case "3":
			search.SetQuery(map[string]any{"match": map[string]any{"r18": true}}, true, q)
		}
	}
	if wallpaper != "" {
		switch wallpaper {
		case "16:10":
			search.SetQuery(map[string]any{"match": map[string]any{"photos.ratio": 1.6}}, true, q)
			prependNekomaidSort(q, "photos.width", "desc")
		case "16:9":
			search.SetQuery(map[string]any{"range": map[string]any{"photos.ratio": map[string]any{"gte": 1.77, "lte": 1.78}}}, true, q)
			prependNekomaidSort(q, "photos.width", "desc")
		case "4:3":
			search.SetQuery(map[string]any{"range": map[string]any{"photos.ratio": map[string]any{"gte": 1.33, "lte": 1.34}}}, true, q)
			prependNekomaidSort(q, "photos.width", "desc")
		}
		if width, err := strconv.Atoi(minWidth); err == nil && width > 0 {
			search.SetQuery(map[string]any{"range": map[string]any{"photos.width": map[string]any{"gte": width}}}, true, q)
		}
	}
	if t != "" {
		switch t {
		case "illust":
			search.SetQuery(map[string]any{"match": map[string]any{"photos_cnt": 1}}, true, q)
			search.SetQuery(map[string]any{"match": map[string]any{"gif": 0}}, true, q)
			search.SetQuery(map[string]any{"match": map[string]any{"r18": false}}, true, q)
		case "manga":
			search.SetQuery(map[string]any{"range": map[string]any{"photos_cnt": map[string]any{"gte": 2}}}, true, q)
			search.SetQuery(map[string]any{"match": map[string]any{"gif": 0}}, true, q)
			search.SetQuery(map[string]any{"match": map[string]any{"r18": false}}, true, q)
		case "ugoira", "animated", "gif":
			search.SetQuery(map[string]any{
				"bool": map[string]any{
					"should": []map[string]any{
						{"match": map[string]any{"type": "ugoira"}},
						{"match": map[string]any{"gif": 1}},
					},
					"minimum_should_match": 1,
				},
			}, true, q)
		}
	}
	if _, ok := q["aggregations"]; !ok {
		q["aggregations"] = map[string]any{
			"tags": map[string]any{
				"significant_terms": map[string]any{
					"field": "tags.keyword",
					"size":  30,
				},
			},
		}
	}
	rawResponse, cleaned, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow]("nekomaid", q, f)
	if err != nil {
		return nil, err
	}
	return searchResponse(rawResponse, cleaned, currentOffset, cursorValue, site, authorId, path), nil
}

func searchPage(ctx fiber.Ctx) int {
	for _, key := range []string{"p", "page", "next_token"} {
		if page, err := strconv.Atoi(ctx.Query(key, "")); err == nil && page > 0 {
			return page
		}
	}
	return 1
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func nekomaidDefaultSort() []map[string]any {
	return []map[string]any{
		{"published_dt": map[string]any{"order": "desc"}},
		{"artwork_id.keyword": map[string]any{"order": "desc"}},
	}
}

func prependNekomaidSort(query map[string]any, field string, order string) {
	next := []map[string]any{{field: map[string]any{"order": order}}}
	if existing, ok := query["sort"].([]map[string]any); ok {
		next = append(next, existing...)
	} else {
		next = append(next, nekomaidDefaultSort()...)
	}
	query["sort"] = next
}

func searchResponse(
	raw *entity.ElasticSearchResponse[nekomaid.ArtworkSearchResult],
	rows []nekomaid.ArtworkSearchClearRow,
	currentOffset int64,
	currentCursor string,
	site string,
	authorId string,
	path string,
) *nekomaid.ArtworkSearchResponse {
	total := raw.Hits.Total.Value
	tags := aggregationTags(raw)
	payload := nekomaid.ArtworkSearchPayload{
		Items:        rows,
		Artworks:     rows,
		RelativeTags: tags,
		Aggregations: map[string][]string{"tags": tags},
	}
	if site != "" && authorId != "" {
		author, _ := nekomaidRepo.NewNekomaidRepository().GetAuthor(enum.NekomaidSite(site), authorId)
		payload.Author = author
	}

	var nextSearchAfter []any
	if len(raw.Hits.Hits) > 0 {
		nextSearchAfter = raw.Hits.Hits[len(raw.Hits.Hits)-1].Sort
	}

	rowsCount := int64(len(rows))
	response := &entity.CommonESPaginationOutput[nekomaid.ArtworkSearchPayload]{
		Data:          payload,
		From:          currentOffset + 1,
		To:            currentOffset + rowsCount,
		Total:         total,
		PerPage:       searchPageSize,
		Path:          path,
		CurrentCursor: currentCursor,
	}
	if rowsCount == 0 {
		response.From = 0
		response.To = 0
	}
	if rowsCount > 0 && len(nextSearchAfter) > 0 && currentOffset+rowsCount < total {
		if nextCursor, err := helper.EncodeESCursor(helper.ESCursor{
			SearchAfter: nextSearchAfter,
			Offset:      currentOffset + rowsCount,
		}); err == nil {
			response.NextCursor = nextCursor
			response.HasNext = true
		}
	}

	return response
}

func aggregationTags(raw *entity.ElasticSearchResponse[nekomaid.ArtworkSearchResult]) []string {
	if raw == nil || raw.Aggregations == nil {
		return []string{}
	}
	aggregation, ok := raw.Aggregations["tags"]
	if !ok {
		return []string{}
	}
	tags := make([]string, 0, len(aggregation.Buckets))
	for _, bucket := range aggregation.Buckets {
		tags = append(tags, bucket.Key)
	}
	return tags
}

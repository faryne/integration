package nekomaid

import (
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"

	"faryne.dev/model/entity"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidRepo "faryne.dev/repository/nekomaid"
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

func Search(ctx fiber.Ctx) (*nekomaid.ArtworkSearchResponse, error) {
	site := strings.TrimSpace(ctx.Params("site", ""))
	sites := strings.TrimSpace(ctx.Query("sites", ""))
	page := searchPage(ctx)
	authorId := ctx.Params("authorId", "")
	artworkId := ctx.Params("artworkId", "")
	tag := ctx.Query("tag", "")
	rating := ctx.Query("rating", "")
	t := ctx.Query("type", "")
	wallpaper := ctx.Query("wallpaper", "")
	minWidth := ctx.Query("min_width", "")

	q := map[string]any{
		"size": searchPageSize,
		"from": (page - 1) * searchPageSize,
		"sort": map[string]any{"published_dt": map[string]any{"order": "desc"}},
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
			search.SetSort(q, "photos.width", "desc")
		case "16:9":
			search.SetQuery(map[string]any{"range": map[string]any{"photos.ratio": map[string]any{"gte": 1.77, "lte": 1.78}}}, true, q)
			search.SetSort(q, "photos.width", "desc")
		case "4:3":
			search.SetQuery(map[string]any{"range": map[string]any{"photos.ratio": map[string]any{"gte": 1.33, "lte": 1.34}}}, true, q)
			search.SetSort(q, "photos.width", "desc")
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
	return searchResponse(ctx, rawResponse, cleaned, page, site, authorId), nil
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

func searchResponse(
	ctx fiber.Ctx,
	raw *entity.ElasticSearchResponse[nekomaid.ArtworkSearchResult],
	rows []nekomaid.ArtworkSearchClearRow,
	page int,
	site string,
	authorId string,
) *nekomaid.ArtworkSearchResponse {
	total := raw.Hits.Total.Value
	tags := aggregationTags(raw)
	response := &nekomaid.ArtworkSearchResponse{
		Total:        total,
		PerPage:      searchPageSize,
		Items:        rows,
		Artworks:     rows,
		RelativeTags: tags,
		Aggregations: map[string][]string{"tags": tags},
	}
	if page > 1 {
		response.PrevLink = paginationLink(ctx, page-1)
	}
	if int64(page*searchPageSize) < total {
		response.NextToken = strconv.Itoa(page + 1)
		response.NextLink = paginationLink(ctx, page+1)
	}
	if site != "" && authorId != "" {
		author, _ := nekomaidRepo.NewNekomaidRepository().GetAuthor(enum.NekomaidSite(site), authorId)
		response.Author = author
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

func paginationLink(ctx fiber.Ctx, page int) string {
	values, _ := url.ParseQuery(string(ctx.Request().URI().QueryString()))
	values.Del("next_token")
	values.Del("page")
	values.Set("p", strconv.Itoa(page))
	path := ctx.Path()
	if query := values.Encode(); query != "" {
		return path + "?" + query
	}
	return path
}

package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	avService "faryne.dev/service/av"
)

type videoSearchArguments struct {
	Year      int             `json:"year"`
	Month     int             `json:"month"`
	Day       int             `json:"day"`
	StartDate string          `json:"start_date"`
	EndDate   string          `json:"end_date"`
	Keyword   string          `json:"keyword"`
	Tag       stringOrStrings `json:"tag"`
	Actress   string          `json:"actress"`
	Maker     string          `json:"maker"`
	Label     string          `json:"label"`
	Series    string          `json:"series"`
	Director  string          `json:"director"`
	No        string          `json:"no"`
	Page      int             `json:"page"`
	// Facets 為 true 時結果多帶目前條件下的常見標籤／發售商／系列／出演
	Facets bool `json:"facets"`
}

// stringOrStrings 同時接受單一字串或字串陣列（tag 可複選，舊的單一字串呼叫照樣可用）
type stringOrStrings []string

func (s *stringOrStrings) UnmarshalJSON(data []byte) error {
	var one string
	if err := json.Unmarshal(data, &one); err == nil {
		if one != "" {
			*s = []string{one}
		}
		return nil
	}
	var many []string
	if err := json.Unmarshal(data, &many); err != nil {
		return fmt.Errorf("tag must be a string or an array of strings")
	}
	*s = many
	return nil
}

type actressSearchArguments struct {
	Cup        string `json:"cup"`
	B          []int  `json:"b"`
	W          []int  `json:"w"`
	H          []int  `json:"h"`
	Height     []int  `json:"height"`
	Name       string `json:"name"`
	BirthYear  int    `json:"birth_year"`
	BirthMonth int    `json:"birth_month"`
	BirthDay   int    `json:"birth_day"`
	BloodType  string `json:"blood_type"`
	Page       int    `json:"page"`
}

type searchResult struct {
	Total  int64                 `json:"total"`
	Page   int                   `json:"page"`
	Data   interface{}           `json:"data"`
	Facets *avEntity.VideoFacets `json:"facets,omitempty"`
}

func (s *Server) registerAVTools() {
	_ = s.RegisterTool(Tool{
		Name:        "av_video_search",
		Description: "Search AV video records by keyword, tags, actress, maker, label, series, director, video number, date, or page. Set facets=true to also get the most common tags/makers/series/actresses (with counts) under the same conditions, useful for narrowing down.",
		InputSchema: objectSchema(map[string]interface{}{
			"year":       integerSchema("Release year."),
			"month":      integerSchema("Release month."),
			"day":        integerSchema("Release day."),
			"start_date": stringSchema("Start date in YYYY-MM-DD."),
			"end_date":   stringSchema("End date in YYYY-MM-DD."),
			"keyword":    stringSchema("Keyword: phrase match on title, partial (substring) match on actresses, series, makers, directors, labels and tags. Use the exact filters (actress, series, maker, ...) when the full name is known."),
			"tag": map[string]interface{}{
				"description": "Exact tag filter. A string, or an array of strings that must all match (AND).",
				"anyOf": []interface{}{
					map[string]interface{}{"type": "string"},
					map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
				},
			},
			"actress":  stringSchema("Exact actress name filter."),
			"maker":    stringSchema("Exact maker filter."),
			"label":    stringSchema("Exact label filter."),
			"series":   stringSchema("Exact series filter."),
			"director": stringSchema("Exact director filter."),
			"facets":   map[string]interface{}{"type": "boolean", "description": "Also return facets (top tags 15, makers/series/actresses 10 each, with counts) for the same conditions. Defaults to false."},
			"no":       stringSchema("Video number or maker number."),
			"page":     integerSchema("Page number, defaults to 1."),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args videoSearchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			req := avEntity.VideoQueryRequest{
				Year:     args.Year,
				Month:    args.Month,
				Day:      args.Day,
				Keyword:  args.Keyword,
				Tag:      args.Tag,
				Actress:  args.Actress,
				Maker:    args.Maker,
				Label:    args.Label,
				Series:   args.Series,
				Director: args.Director,
				No:       args.No,
				Page:     normalizedPage(args.Page),
			}
			if args.StartDate != "" {
				startDate, err := parseOnlyDate(args.StartDate)
				if err != nil {
					return nil, fmt.Errorf("invalid start_date: %w", err)
				}
				req.StartDate = &startDate
			}
			if args.EndDate != "" {
				endDate, err := parseOnlyDate(args.EndDate)
				if err != nil {
					return nil, fmt.Errorf("invalid end_date: %w", err)
				}
				req.EndDate = &endDate
			}

			r, rows, err := avService.VideoSearch(req)
			if err != nil {
				return nil, err
			}
			result := searchResult{Total: r.Hits.Total.Value, Page: req.Page, Data: rows}
			if args.Facets {
				facets, err := avService.VideoFacets(req)
				if err != nil {
					return nil, err
				}
				result.Facets = &facets
			}
			return jsonTextResult(result)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "av_actress_search",
		Description: "Search AV actress records by name, measurements, birthday, cup, blood type, or page.",
		InputSchema: objectSchema(map[string]interface{}{
			"cup":         stringSchema("Cup filter."),
			"b":           integerArraySchema("Bust value or [min, max) range."),
			"w":           integerArraySchema("Waist value or [min, max) range."),
			"h":           integerArraySchema("Hips value or [min, max) range."),
			"height":      integerArraySchema("Height value or [min, max) range."),
			"name":        stringSchema("Exact actress name."),
			"birth_year":  integerSchema("Birth year."),
			"birth_month": integerSchema("Birth month."),
			"birth_day":   integerSchema("Birth day."),
			"blood_type":  stringSchema("Blood type."),
			"page":        integerSchema("Page number, defaults to 1."),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args actressSearchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			req := avEntity.ActressQueryRequest{
				Cup:        args.Cup,
				B:          args.B,
				W:          args.W,
				H:          args.H,
				Height:     args.Height,
				Name:       args.Name,
				BirthYear:  args.BirthYear,
				BirthMonth: args.BirthMonth,
				BirthDay:   args.BirthDay,
				BloodType:  args.BloodType,
				Page:       normalizedPage(args.Page),
			}

			r, rows, err := avService.ActressSearch(req)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(searchResult{
				Total: r.Hits.Total.Value,
				Page:  req.Page,
				Data:  rows,
			})
		},
	})
}

func decodeArguments(arguments map[string]interface{}, out interface{}) error {
	body, err := json.Marshal(arguments)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, out)
}

func normalizedPage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

func parseOnlyDate(value string) (entity.OnlyDateFormat, error) {
	t, err := time.Parse(time.DateOnly, value)
	if err != nil {
		return entity.OnlyDateFormat(time.Time{}), err
	}
	return entity.OnlyDateFormat(t), nil
}

func jsonTextResult(v interface{}) (*CallToolResult, error) {
	body, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return textResult(string(body)), nil
}

func stringSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "string",
		"description": description,
	}
}

func integerSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "integer",
		"description": description,
	}
}

func integerArraySchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "array",
		"description": description,
		"items":       map[string]interface{}{"type": "integer"},
		"minItems":    1,
		"maxItems":    2,
	}
}

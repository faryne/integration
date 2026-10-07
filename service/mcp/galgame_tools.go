package mcp

import (
	"context"
	"fmt"
	"strings"

	"faryne.dev/model/entity"
	erogeModel "faryne.dev/model/entity/eroge"
	erogeService "faryne.dev/service/eroge"
)

const (
	galgameSearchChannels = "channels"
	galgameSearchVideos   = "videos"
	galgameDefaultPerPage = int64(24)
	galgameMaxPerPage     = int64(100)
)

type galgameSubmissionService interface {
	SubmitBrands(context.Context, uint64, []string) ([]erogeModel.BrandSubmissionResult, error)
	SubmitVideos(context.Context, uint64, []string) ([]erogeModel.VideoSubmissionResult, error)
}

type galgameCatalogService interface {
	SearchBrands(erogeModel.BrandSearchRequest) ([]erogeModel.BrandOutput, int64, error)
	SearchVideos(string, erogeModel.VideoSearchRequest) ([]erogeModel.VideoOutput, int64, error)
}

type galgameSubmitChannelsArguments struct {
	Channels []string `json:"channels"`
}

type galgameSubmitVideosArguments struct {
	URLs []string `json:"urls"`
}

type galgameSearchArguments struct {
	Kind            string `json:"kind"`
	Keyword         string `json:"keyword"`
	BrandPublicID   string `json:"brand_public_id"`
	PublishedAtFrom string `json:"published_at_from"`
	PublishedAtTo   string `json:"published_at_to"`
	Page            int64  `json:"page"`
	PerPage         int64  `json:"per_page"`
}

type galgameSearchResult struct {
	Kind    string      `json:"kind"`
	Total   int64       `json:"total"`
	Page    int64       `json:"page"`
	PerPage int64       `json:"per_page"`
	Data    interface{} `json:"data"`
}

type galgameToolDependencies struct {
	newSubmissionService func(context.Context) (galgameSubmissionService, error)
	newCatalogService    func() galgameCatalogService
}

func (s *Server) registerGalgameTools() {
	s.registerGalgameToolsWithDependencies(galgameToolDependencies{
		newSubmissionService: func(ctx context.Context) (galgameSubmissionService, error) {
			return erogeService.NewService(ctx)
		},
		newCatalogService: func() galgameCatalogService { return erogeService.NewCatalogService() },
	})
}

// registerGalgameToolsWithDependencies 保留 service 注入點，讓 MCP 參數轉換可在不連 DB／YouTube 的情況下測試。
func (s *Server) registerGalgameToolsWithDependencies(deps galgameToolDependencies) {
	_ = s.RegisterTool(Tool{
		Name:        "galgame_submit_channels",
		Description: "Submit one or more YouTube channels to galgame.tv for review. Existing channels are returned without creating duplicates.",
		InputSchema: objectSchema(map[string]interface{}{
			"channels": stringArraySchema("YouTube channel URLs, @handles, or UC... channel IDs."),
		}, []string{"channels"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args galgameSubmitChannelsArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if !hasNonEmptyString(args.Channels) {
				return nil, fmt.Errorf("channels is required")
			}
			service, err := deps.newSubmissionService(ctx)
			if err != nil {
				return nil, err
			}
			results, err := service.SubmitBrands(ctx, 0, args.Channels)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(results)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "galgame_submit_videos",
		Description: "Submit one or more YouTube videos to galgame.tv for review. Their channels are submitted automatically when needed.",
		InputSchema: objectSchema(map[string]interface{}{
			"urls": stringArraySchema("YouTube video URLs in youtube.com/watch?v=... or youtu.be/... format."),
		}, []string{"urls"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args galgameSubmitVideosArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			if !hasNonEmptyString(args.URLs) {
				return nil, fmt.Errorf("urls is required")
			}
			service, err := deps.newSubmissionService(ctx)
			if err != nil {
				return nil, err
			}
			results, err := service.SubmitVideos(ctx, 0, args.URLs)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(results)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "galgame_search",
		Description: "Search galgame.tv using the same approved channel and video catalog as the website.",
		InputSchema: objectSchema(map[string]interface{}{
			"kind":              stringEnumSchema("Search target.", galgameSearchVideos, galgameSearchChannels),
			"keyword":           stringSchema("Keyword matched against video titles, descriptions, and tags, or channel names."),
			"brand_public_id":   stringSchema("Optional channel public ID filter. Only valid when kind is videos."),
			"published_at_from": stringSchema("Optional video publish date lower bound in YYYY-MM-DD. Only valid when kind is videos."),
			"published_at_to":   stringSchema("Optional video publish date upper bound in YYYY-MM-DD. Only valid when kind is videos."),
			"page":              integerMinimumSchema("Page number, defaults to 1.", 1),
			"per_page":          integerRangeSchema("Results per page, defaults to 24.", 1, galgameMaxPerPage),
		}, []string{"kind"}),
		Handler: func(_ context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args galgameSearchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			page, perPage, err := galgamePagination(args.Page, args.PerPage)
			if err != nil {
				return nil, err
			}
			catalog := deps.newCatalogService()
			pagination := entity.CommonPaginationQueryRequest{Page: page, PerPage: perPage}
			result := galgameSearchResult{Kind: args.Kind, Page: page, PerPage: perPage}

			switch args.Kind {
			case galgameSearchChannels:
				if strings.TrimSpace(args.BrandPublicID) != "" || args.PublishedAtFrom != "" || args.PublishedAtTo != "" {
					return nil, fmt.Errorf("brand_public_id and published_at filters are only valid when kind is videos")
				}
				rows, total, err := catalog.SearchBrands(erogeModel.BrandSearchRequest{
					CommonPaginationQueryRequest: pagination,
					Keyword:                      args.Keyword,
				})
				if err != nil {
					return nil, err
				}
				result.Total, result.Data = total, rows
			case galgameSearchVideos:
				rows, total, err := catalog.SearchVideos(strings.TrimSpace(args.BrandPublicID), erogeModel.VideoSearchRequest{
					CommonPaginationQueryRequest: pagination,
					Keyword:                      args.Keyword,
					PublishedAtFrom:              args.PublishedAtFrom,
					PublishedAtTo:                args.PublishedAtTo,
				})
				if err != nil {
					return nil, err
				}
				result.Total, result.Data = total, rows
			default:
				return nil, fmt.Errorf("kind must be %q or %q", galgameSearchVideos, galgameSearchChannels)
			}
			return jsonTextResult(result)
		},
	})
}

func galgamePagination(page, perPage int64) (int64, int64, error) {
	if page < 0 {
		return 0, 0, fmt.Errorf("page must be greater than 0")
	}
	if perPage < 0 || perPage > galgameMaxPerPage {
		return 0, 0, fmt.Errorf("per_page must be between 1 and %d", galgameMaxPerPage)
	}
	if page == 0 {
		page = 1
	}
	if perPage == 0 {
		perPage = galgameDefaultPerPage
	}
	return page, perPage, nil
}

func hasNonEmptyString(values []string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}

func stringArraySchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "array",
		"description": description,
		"items":       map[string]interface{}{"type": "string"},
		"minItems":    1,
	}
}

func stringEnumSchema(description string, values ...string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "string",
		"description": description,
		"enum":        values,
	}
}

func integerMinimumSchema(description string, minimum int64) map[string]interface{} {
	return map[string]interface{}{
		"type":        "integer",
		"description": description,
		"minimum":     minimum,
	}
}

func integerRangeSchema(description string, minimum, maximum int64) map[string]interface{} {
	schema := integerMinimumSchema(description, minimum)
	schema["maximum"] = maximum
	return schema
}

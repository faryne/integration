package mcp

import (
	"context"

	nekomaidModel "faryne.dev/model/entity/nekomaid"
	nekomaidService "faryne.dev/service/nekomaid"
	nekomaidRetrieve "faryne.dev/service/nekomaid/retrieve"
)

type nekomaidSearchArguments struct {
	Site      string `json:"site"`
	Sites     string `json:"sites"`
	AuthorId  string `json:"author_id"`
	ArtworkId string `json:"artwork_id"`
	Tag       string `json:"tag"`
	Rating    string `json:"rating"`
	Type      string `json:"type"`
	Wallpaper string `json:"wallpaper"`
	MinWidth  string `json:"min_width"`
	Page      int    `json:"page"`
}

type nekomaidRetrieveArguments struct {
	Site      string `json:"site"`
	ArtworkID string `json:"artwork_id"`
}

type nekomaidToolDependencies struct {
	search   func(nekomaidService.SearchRequest) (*nekomaidModel.ArtworkSearchResponse, error)
	retrieve func(context.Context, string, string) (*nekomaidRetrieve.Result, error)
}

func (s *Server) registerNekomaidTools() {
	s.registerNekomaidToolsWithDependencies(nekomaidToolDependencies{
		search:   nekomaidService.SearchByRequest,
		retrieve: nekomaidRetrieve.Artwork,
	})
}

// registerNekomaidToolsWithDependencies 讓 MCP 參數轉換可獨立測試，不必真的連 Elasticsearch 或來源站。
func (s *Server) registerNekomaidToolsWithDependencies(deps nekomaidToolDependencies) {
	_ = s.RegisterTool(Tool{
		Name:        "nekomaid_search",
		Description: "Search indexed Nekomaid artworks by site, author, artwork, tag, rating, type, wallpaper ratio, or page.",
		InputSchema: objectSchema(map[string]interface{}{
			"site":       stringSchema("Single site filter, for example pixiv, nico, or tinami."),
			"sites":      stringSchema("Comma-separated site filters."),
			"author_id":  stringSchema("Author ID filter."),
			"artwork_id": stringSchema("Artwork ID filter."),
			"tag":        stringSchema("Tag or exact title filter."),
			"rating":     stringSchema("Rating filter. Use 2 for non-R18 and 3 for R18."),
			"type":       stringSchema("Artwork type filter: illust, manga, ugoira, animated, or gif."),
			"wallpaper":  stringSchema("Wallpaper ratio filter: 16:10, 16:9, or 4:3."),
			"min_width":  stringSchema("Minimum photo width when wallpaper is set."),
			"page":       integerSchema("Page number, defaults to 1."),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args nekomaidSearchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			response, err := deps.search(nekomaidService.SearchRequest{
				Site:      args.Site,
				Sites:     args.Sites,
				Page:      normalizedPage(args.Page),
				AuthorId:  args.AuthorId,
				ArtworkId: args.ArtworkId,
				Tag:       args.Tag,
				Rating:    args.Rating,
				Type:      args.Type,
				Wallpaper: args.Wallpaper,
				MinWidth:  args.MinWidth,
			})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(response)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "nekomaid_retrieve",
		Description: "Retrieve an artwork from Pixiv, Nico Seiga, or Tinami, then store and index it in Nekomaid. Large Pixiv artworks may be queued for background processing.",
		InputSchema: objectSchema(map[string]interface{}{
			"site":       stringEnumSchema("Source site.", "pixiv", "nico", "tinami"),
			"artwork_id": stringSchema("Artwork ID on the source site. Tinami expects the numeric content ID."),
		}, []string{"site", "artwork_id"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args nekomaidRetrieveArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := deps.retrieve(ctx, args.Site, args.ArtworkID)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})
}

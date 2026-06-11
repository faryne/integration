package mcp

import (
	"context"

	nekomaidService "faryne.dev/service/nekomaid"
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

func (s *Server) registerNekomaidTools() {
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
			response, err := nekomaidService.SearchByRequest(nekomaidService.SearchRequest{
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
}

package nekomaid

import (
	"fmt"
	"html"
	"strings"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/service/rss"

	"github.com/gofiber/fiber/v3"
)

func SearchRSS(ctx fiber.Ctx) (string, error) {
	response, err := Search(ctx)
	if err != nil {
		return "", err
	}
	return BuildSearchRSS(ctx, response)
}

func BuildSearchRSS(ctx fiber.Ctx, response *nekomaid.ArtworkSearchResponse) (string, error) {
	channel := rss.Channel{
		Title:       searchRSSTitle(response),
		Link:        Home + ctx.Path(),
		Description: "Nekomaid artwork search results",
		Items:       make([]rss.Item, 0, len(response.Data.Items)),
	}
	for _, artwork := range response.Data.Items {
		channel.Items = append(channel.Items, rss.Item{
			Title:       artwork.Title,
			Link:        artwork.NekomaidLink,
			GUID:        rss.GUID{IsPermaLink: true, Value: artwork.NekomaidLink},
			Description: rss.Description{Value: searchRSSDescription(artwork)},
			PubDate:     searchRSSPubDate(artwork.PublishedDt),
			Categories:  artwork.Tags,
			Enclosure:   rss.ImageEnclosure(artwork.Thumb),
		})
	}
	return rss.Render(channel)
}

func searchRSSTitle(response *nekomaid.ArtworkSearchResponse) string {
	if response != nil && response.Data.Author != nil && strings.TrimSpace(response.Data.Author.Nickname) != "" {
		return fmt.Sprintf("Nekomaid: %s", response.Data.Author.Nickname)
	}
	return "Nekomaid Search"
}

func searchRSSDescription(artwork nekomaid.ArtworkSearchClearRow) string {
	parts := make([]string, 0, 3)
	if artwork.Thumb != "" {
		parts = append(parts, fmt.Sprintf(`<p><img src="%s" alt="%s"></p>`, html.EscapeString(artwork.Thumb), html.EscapeString(artwork.Title)))
	}
	if artwork.Title != "" {
		parts = append(parts, fmt.Sprintf("<p>%s</p>", html.EscapeString(artwork.Title)))
	}
	if len(artwork.Tags) > 0 {
		parts = append(parts, fmt.Sprintf("<p>Tags: %s</p>", html.EscapeString(strings.Join(artwork.Tags, ", "))))
	}
	return strings.Join(parts, "\n")
}

func searchRSSPubDate(publishedDt int) string {
	if publishedDt <= 0 {
		return ""
	}
	return rss.PubDate(time.Unix(int64(publishedDt), 0).UTC())
}

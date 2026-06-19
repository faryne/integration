package nekomaid

import (
	"encoding/xml"
	"fmt"
	"html"
	"strings"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"github.com/gofiber/fiber/v3"
)

type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string    `xml:"title"`
	Link        string    `xml:"link"`
	Description string    `xml:"description"`
	Items       []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string         `xml:"title"`
	Link        string         `xml:"link"`
	GUID        rssGUID        `xml:"guid"`
	Description rssDescription `xml:"description"`
	PubDate     string         `xml:"pubDate,omitempty"`
	Categories  []string       `xml:"category,omitempty"`
	Enclosure   *rssEnclosure  `xml:"enclosure,omitempty"`
}

type rssGUID struct {
	IsPermaLink bool   `xml:"isPermaLink,attr"`
	Value       string `xml:",chardata"`
}

type rssDescription struct {
	Value string `xml:",cdata"`
}

type rssEnclosure struct {
	URL    string `xml:"url,attr"`
	Type   string `xml:"type,attr"`
	Length int    `xml:"length,attr"`
}

func SearchRSS(ctx fiber.Ctx) (string, error) {
	response, err := Search(ctx)
	if err != nil {
		return "", err
	}
	return BuildSearchRSS(ctx, response)
}

func BuildSearchRSS(ctx fiber.Ctx, response *nekomaid.ArtworkSearchResponse) (string, error) {
	feed := rssFeed{
		Version: "2.0",
		Channel: rssChannel{
			Title:       searchRSSTitle(response),
			Link:        Home + ctx.Path(),
			Description: "Nekomaid artwork search results",
			Items:       make([]rssItem, 0, len(response.Data.Items)),
		},
	}

	for _, artwork := range response.Data.Items {
		item := rssItem{
			Title:       artwork.Title,
			Link:        artwork.NekomaidLink,
			GUID:        rssGUID{IsPermaLink: true, Value: artwork.NekomaidLink},
			Description: rssDescription{Value: searchRSSDescription(artwork)},
			PubDate:     searchRSSPubDate(artwork.PublishedDt),
			Categories:  artwork.Tags,
		}
		if artwork.Thumb != "" {
			item.Enclosure = &rssEnclosure{
				URL:    artwork.Thumb,
				Type:   rssImageMimeType(artwork.Thumb),
				Length: 0,
			}
		}
		feed.Channel.Items = append(feed.Channel.Items, item)
	}

	body, err := xml.MarshalIndent(feed, "", "  ")
	if err != nil {
		return "", err
	}
	return xml.Header + string(body), nil
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
	return time.Unix(int64(publishedDt), 0).UTC().Format(time.RFC1123Z)
}

func rssImageMimeType(url string) string {
	lower := strings.ToLower(url)
	switch {
	case strings.Contains(lower, ".png"):
		return "image/png"
	case strings.Contains(lower, ".gif"):
		return "image/gif"
	case strings.Contains(lower, ".webp"):
		return "image/webp"
	default:
		return "image/jpeg"
	}
}

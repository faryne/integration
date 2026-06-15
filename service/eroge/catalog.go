package eroge

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	erogeModel "faryne.dev/model/entity/eroge"
	erogeRepo "faryne.dev/repository/eroge"
)

var brandURLPattern = regexp.MustCompile(`https?://[^\s<>"'）)]+`)

type CatalogService struct {
	repo *erogeRepo.YouTubeRepository
}

func NewCatalogService() *CatalogService {
	return &CatalogService{repo: erogeRepo.NewYouTubeRepository()}
}

func (s *CatalogService) SearchBrands(input erogeModel.BrandSearchRequest) ([]erogeModel.BrandOutput, int64, error) {
	brands, total, err := s.repo.SearchBrands(input)
	if err != nil {
		return nil, 0, err
	}
	output := make([]erogeModel.BrandOutput, 0, len(brands))
	for _, brand := range brands {
		output = append(output, buildBrandOutput(brand))
	}
	return output, total, nil
}

func (s *CatalogService) SearchVideos(
	brandValue string,
	input erogeModel.VideoSearchRequest,
) ([]erogeModel.VideoOutput, int64, error) {
	brandPublicID, err := parseBrandPublicID(brandValue)
	if err != nil {
		return nil, 0, err
	}
	from, err := parseDate(input.PublishedAtFrom, false)
	if err != nil {
		return nil, 0, fmt.Errorf("published_at_from: %w", err)
	}
	to, err := parseDate(input.PublishedAtTo, true)
	if err != nil {
		return nil, 0, fmt.Errorf("published_at_to: %w", err)
	}
	if from != nil && to != nil && !from.Before(*to) {
		return nil, 0, fmt.Errorf("published_at_from must not be later than published_at_to")
	}
	return s.repo.SearchVideos(brandPublicID, input, from, to)
}

func (s *CatalogService) Video(brandValue, videoID string) (*erogeModel.VideoOutput, error) {
	brandPublicID, err := parseBrandPublicID(brandValue)
	if err != nil {
		return nil, err
	}
	return s.repo.Video(brandPublicID, strings.TrimSpace(videoID))
}

func parseBrandPublicID(value string) (string, error) {
	if strings.TrimSpace(value) == "" {
		return "", nil
	}
	publicID := strings.SplitN(value, "-", 2)[0]
	if len(publicID) != 32 {
		return "", fmt.Errorf("invalid brand ID")
	}
	for _, char := range publicID {
		if !strings.ContainsRune("0123456789abcdef", char) {
			return "", fmt.Errorf("invalid brand ID")
		}
	}
	return publicID, nil
}

func parseDate(value string, exclusiveEnd bool) (*time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	parsed, err := time.ParseInLocation(time.DateOnly, value, time.Local)
	if err != nil {
		return nil, fmt.Errorf("must use YYYY-MM-DD format")
	}
	if exclusiveEnd {
		parsed = parsed.AddDate(0, 0, 1)
	}
	return &parsed, nil
}

func buildBrandOutput(brand erogeModel.Brand) erogeModel.BrandOutput {
	output := erogeModel.BrandOutput{
		ID: brand.ID, PublicID: brand.PublicID, Name: brand.Name,
		YouTubeChannelID: brand.YouTubeChannelID, AvatarURL: brand.AvatarURL,
		Links: []erogeModel.BrandLink{{
			Label: "YouTube",
			URL:   "https://www.youtube.com/channel/" + brand.YouTubeChannelID,
		}},
	}
	var channel struct {
		Snippet struct {
			Description string `json:"description"`
			CustomURL   string `json:"customUrl"`
		} `json:"snippet"`
		Statistics struct {
			SubscriberCount uint64 `json:"subscriberCount,string"`
			VideoCount      uint64 `json:"videoCount,string"`
			ViewCount       uint64 `json:"viewCount,string"`
		} `json:"statistics"`
	}
	if json.Unmarshal([]byte(brand.YouTubeInfo), &channel) != nil {
		return output
	}
	output.Description = channel.Snippet.Description
	output.CustomURL = channel.Snippet.CustomURL
	output.SubscriberCount = channel.Statistics.SubscriberCount
	output.VideoCount = channel.Statistics.VideoCount
	output.ViewCount = channel.Statistics.ViewCount
	output.Links = append(output.Links, descriptionLinks(output.Description)...)
	return output
}

func descriptionLinks(description string) []erogeModel.BrandLink {
	seen := make(map[string]struct{})
	links := make([]erogeModel.BrandLink, 0)
	for _, rawURL := range brandURLPattern.FindAllString(description, -1) {
		parsed, err := url.Parse(rawURL)
		if err != nil || parsed.Hostname() == "" {
			continue
		}
		normalized := parsed.String()
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		links = append(links, erogeModel.BrandLink{
			Label: linkLabel(parsed.Hostname()),
			URL:   normalized,
		})
	}
	return links
}

func linkLabel(host string) string {
	host = strings.TrimPrefix(strings.ToLower(host), "www.")
	switch {
	case host == "x.com" || host == "twitter.com":
		return "X / Twitter"
	case host == "facebook.com":
		return "Facebook"
	case host == "instagram.com":
		return "Instagram"
	case host == "youtube.com" || host == "youtu.be":
		return "YouTube"
	default:
		return host
	}
}

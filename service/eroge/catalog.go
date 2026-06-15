package eroge

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
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

func (s *CatalogService) Brand(brandValue string) (*erogeModel.BrandOutput, error) {
	publicID, err := parseBrandPublicID(brandValue)
	if err != nil {
		return nil, err
	}
	brand, err := s.repo.Brand(publicID)
	if err != nil {
		return nil, err
	}
	output := buildBrandOutput(*brand)
	return &output, nil
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

func (s *CatalogService) RelatedVideos(brandValue, videoID string) ([]erogeModel.VideoOutput, error) {
	video, err := s.Video(brandValue, videoID)
	if err != nil {
		return nil, err
	}
	candidates, err := s.repo.RelatedVideoCandidates(*video)
	if err != nil {
		return nil, err
	}
	sourceTags := parseTags(video.Tags)
	sourceTokens := titleTokens(video.Title)
	scored := make([]erogeModel.RelatedVideoOutput, 0, len(candidates))
	for _, candidate := range candidates {
		score := relatedVideoScore(*video, candidate, sourceTags, sourceTokens)
		scored = append(scored, erogeModel.RelatedVideoOutput{VideoOutput: candidate, Score: score})
	}
	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].Score == scored[j].Score {
			return scored[i].PublishedAt.After(scored[j].PublishedAt)
		}
		return scored[i].Score > scored[j].Score
	})
	limit := min(5, len(scored))
	output := make([]erogeModel.VideoOutput, 0, limit)
	for _, item := range scored[:limit] {
		output = append(output, item.VideoOutput)
	}
	return output, nil
}

func (s *CatalogService) VideoNavigation(brandValue, videoID string) (*erogeModel.VideoNavigationOutput, error) {
	video, err := s.Video(brandValue, videoID)
	if err != nil {
		return nil, err
	}
	previous, next, err := s.repo.AdjacentVideos(*video)
	if err != nil {
		return nil, err
	}
	return &erogeModel.VideoNavigationOutput{Previous: previous, Next: next}, nil
}

func (s *CatalogService) BrandFavorite(userID uint64, brandValue string) (*erogeModel.FavoriteStatus, error) {
	brand, err := s.brandEntity(brandValue)
	if err != nil {
		return nil, err
	}
	favorite, err := s.repo.BrandFavorite(userID, brand.ID)
	return &erogeModel.FavoriteStatus{Favorite: favorite}, err
}

func (s *CatalogService) SetBrandFavorite(userID uint64, brandValue string, favorite bool) (*erogeModel.FavoriteStatus, error) {
	brand, err := s.brandEntity(brandValue)
	if err != nil {
		return nil, err
	}
	if err := s.repo.SetBrandFavorite(userID, brand.ID, favorite); err != nil {
		return nil, err
	}
	return &erogeModel.FavoriteStatus{Favorite: favorite}, nil
}

func (s *CatalogService) VideoFavorite(userID uint64, brandValue, videoID string) (*erogeModel.FavoriteStatus, error) {
	video, err := s.Video(brandValue, videoID)
	if err != nil {
		return nil, err
	}
	favorite, err := s.repo.VideoFavorite(userID, video.ID)
	return &erogeModel.FavoriteStatus{Favorite: favorite}, err
}

func (s *CatalogService) SetVideoFavorite(userID uint64, brandValue, videoID string, favorite bool) (*erogeModel.FavoriteStatus, error) {
	video, err := s.Video(brandValue, videoID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.SetVideoFavorite(userID, video.ID, favorite); err != nil {
		return nil, err
	}
	return &erogeModel.FavoriteStatus{Favorite: favorite}, nil
}

func (s *CatalogService) FavoriteStatus(userID uint64, input erogeModel.FavoriteStatusRequest) (*erogeModel.FavoriteStatusOutput, error) {
	brandIDs, videoIDs, err := s.repo.FavoriteStatus(userID, input.BrandIDs, input.VideoIDs)
	if err != nil {
		return nil, err
	}
	return &erogeModel.FavoriteStatusOutput{BrandIDs: brandIDs, VideoIDs: videoIDs}, nil
}

func (s *CatalogService) FavoriteBrands(userID uint64, input erogeModel.BrandSearchRequest) ([]erogeModel.BrandOutput, int64, error) {
	brands, total, err := s.repo.FavoriteBrands(userID, input)
	if err != nil {
		return nil, 0, err
	}
	output := make([]erogeModel.BrandOutput, 0, len(brands))
	for _, brand := range brands {
		output = append(output, buildBrandOutput(brand))
	}
	return output, total, nil
}

func (s *CatalogService) FavoriteVideos(userID uint64, input erogeModel.VideoSearchRequest) ([]erogeModel.VideoOutput, int64, error) {
	return s.repo.FavoriteVideos(userID, input)
}

func (s *CatalogService) brandEntity(brandValue string) (*erogeModel.Brand, error) {
	publicID, err := parseBrandPublicID(brandValue)
	if err != nil {
		return nil, err
	}
	return s.repo.Brand(publicID)
}

func relatedVideoScore(
	source erogeModel.VideoOutput,
	candidate erogeModel.VideoOutput,
	sourceTags map[string]struct{},
	sourceTokens map[string]struct{},
) int {
	score := 0
	if source.BrandID == candidate.BrandID {
		score += 100
	}
	for tag := range parseTags(candidate.Tags) {
		if _, ok := sourceTags[tag]; ok {
			score += 20
		}
	}
	for token := range titleTokens(candidate.Title) {
		if _, ok := sourceTokens[token]; ok {
			score += 8
		}
	}
	days := int(source.PublishedAt.Sub(candidate.PublishedAt).Abs().Hours() / 24)
	if days < 30 {
		score += 15 - days/2
	}
	return score
}

func parseTags(raw string) map[string]struct{} {
	var tags []string
	_ = json.Unmarshal([]byte(raw), &tags)
	output := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		if normalized := strings.ToLower(strings.TrimSpace(tag)); normalized != "" {
			output[normalized] = struct{}{}
		}
	}
	return output
}

func titleTokens(title string) map[string]struct{} {
	parts := strings.FieldsFunc(strings.ToLower(title), func(char rune) bool {
		return !((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') ||
			(char >= '\u3040' && char <= '\u30ff') || (char >= '\u4e00' && char <= '\u9fff'))
	})
	tokens := make(map[string]struct{}, len(parts))
	for _, token := range parts {
		if len([]rune(token)) >= 2 {
			tokens[token] = struct{}{}
		}
	}
	return tokens
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
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return &parsed, nil
	}
	parsed, err := time.ParseInLocation(time.DateOnly, value, time.Local)
	if err != nil {
		return nil, fmt.Errorf("must use YYYY-MM-DD or RFC3339 format")
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

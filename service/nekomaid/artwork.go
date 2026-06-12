package nekomaid

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/client"
	"faryne.dev/service/search"
)

var ErrArtworkNotFound = errors.New("nekomaid artwork not found")

const artworkDetailCacheTTL = 50 * time.Minute

func GetArtworkDetail(site, authorID, artworkID string) (*nekomaid.ArtworkDetailResponse, error) {
	site = strings.ToLower(strings.TrimSpace(site))
	authorID = strings.TrimSpace(authorID)
	artworkID = strings.TrimSpace(artworkID)
	if site == "tinami" && !strings.HasPrefix(artworkID, "ti") {
		artworkID = "ti" + artworkID
	}
	if site == "" || authorID == "" || artworkID == "" {
		return nil, ErrArtworkNotFound
	}

	cacheKey := artworkDetailCacheKey(site, authorID, artworkID)
	if cached := getCachedArtworkDetail(cacheKey); cached != nil {
		return cached, nil
	}

	repository := nekomaidRepo.NewNekomaidRepository()
	forbidden, err := repository.CheckForbidden(enum.NekomaidSite(site), authorID)
	if err != nil {
		return nil, fmt.Errorf("check forbidden nekomaid author: %w", err)
	}
	if forbidden {
		return nil, ErrArtworkNotFound
	}

	documentID := strings.Join([]string{site, authorID, artworkID}, "-")
	raw, rows, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow](
		"nekomaid",
		map[string]any{"query": map[string]any{"ids": map[string]any{"values": []string{documentID}}}},
		f,
	)
	if err != nil {
		return nil, fmt.Errorf("get nekomaid artwork: %w", err)
	}
	if raw == nil || len(rows) == 0 {
		return nil, ErrArtworkNotFound
	}

	artwork, err := signArtworkPhotos(rows[0])
	if err != nil {
		return nil, err
	}
	recommendations, err := getArtworkRecommendations(documentID)
	if err != nil {
		return nil, err
	}
	author, err := repository.GetAuthor(enum.NekomaidSite(site), authorID)
	if err != nil {
		return nil, fmt.Errorf("get nekomaid author: %w", err)
	}
	response := &nekomaid.ArtworkDetailResponse{
		Artwork:         artwork,
		Author:          author,
		Recommendations: recommendations,
	}
	cacheArtworkDetail(cacheKey, response)
	return response, nil
}

func artworkDetailCacheKey(site, authorID, artworkID string) string {
	return strings.Join([]string{"nekomaid", "artwork", site, authorID, artworkID}, ":")
}

func getCachedArtworkDetail(cacheKey string) *nekomaid.ArtworkDetailResponse {
	redisClient := client.GetRedis(enum.RedisDefault)
	if redisClient == nil {
		return nil
	}
	raw, err := redisClient.Get(cacheKey).Result()
	if err != nil || raw == "" {
		return nil
	}
	var response nekomaid.ArtworkDetailResponse
	if err := json.Unmarshal([]byte(raw), &response); err != nil {
		return nil
	}
	return &response
}

func cacheArtworkDetail(cacheKey string, response *nekomaid.ArtworkDetailResponse) {
	redisClient := client.GetRedis(enum.RedisDefault)
	if redisClient == nil {
		return
	}
	raw, err := json.Marshal(response)
	if err != nil {
		return
	}
	_ = redisClient.Set(cacheKey, string(raw), artworkDetailCacheTTL).Err()
}

func getArtworkRecommendations(documentID string) ([]nekomaid.ArtworkSearchClearRow, error) {
	query := map[string]any{
		"size": 24,
		"query": map[string]any{
			"more_like_this": map[string]any{
				"fields":        []string{"tags.keyword", "title.keyword", "author_id", "from"},
				"like":          []map[string]any{{"_index": "nekomaid", "_id": documentID}},
				"min_term_freq": 1,
			},
		},
	}
	_, rows, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow]("nekomaid", query, f)
	if err != nil {
		return nil, fmt.Errorf("get nekomaid recommendations: %w", err)
	}
	for i := range rows {
		rows[i], err = signArtworkPhotos(rows[i])
		if err != nil {
			return nil, err
		}
	}
	return rows, nil
}

func signArtworkPhotos(artwork nekomaid.ArtworkSearchClearRow) (nekomaid.ArtworkSearchClearRow, error) {
	artwork.From = strings.ToLower(artwork.From)
	for i := range artwork.Photos {
		signedURL, err := artworkURLSigner.sign(artwork.Photos[i].Url)
		if err != nil {
			return artwork, err
		}
		artwork.Photos[i].Url = signedURL
	}
	return artwork, nil
}

package nekomaid

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

type artworkIndexDocument struct {
	ArtworkId     string                 `json:"artwork_id"`
	AuthorId      string                 `json:"author_id"`
	From          enum.NekomaidSite      `json:"from"`
	Gif           int                    `json:"gif"`
	Photos        []artworkIndexPhoto    `json:"photos"`
	PhotosCnt     int                    `json:"photos_cnt"`
	PublishedDt   int64                  `json:"published_dt"`
	R18           bool                   `json:"r18"`
	TagCompletion []artworkTagCompletion `json:"tag_completion"`
	Tags          []string               `json:"tags"`
	Thumb         string                 `json:"thumb"`
	Title         string                 `json:"title"`
	Type          string                 `json:"type"`
}

type artworkIndexPhoto struct {
	Height float64 `json:"height"`
	Ratio  float64 `json:"ratio"`
	Url    string  `json:"url"`
	Width  float64 `json:"width"`
}

type artworkTagCompletion struct {
	Input string `json:"input"`
}

func IndexArtwork(ctx context.Context, artwork *nekomaid.ArtworkMain) error {
	if artwork == nil {
		return fmt.Errorf("nekomaid artwork is nil")
	}

	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}

	doc := buildArtworkIndexDocument(artwork)
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}

	documentID := fmt.Sprintf("%s-%s-%s", doc.From, doc.AuthorId, doc.ArtworkId)
	resp, err := es.Index(
		"nekomaid",
		bytes.NewReader(body),
		es.Index.WithContext(ctx),
		es.Index.WithDocumentID(documentID),
		es.Index.WithRefresh("true"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("index nekomaid artwork failed: status=%s document_id=%s", resp.Status(), documentID)
	}

	return nil
}

func buildArtworkIndexDocument(artwork *nekomaid.ArtworkMain) artworkIndexDocument {
	content := artwork.FullContent
	photos := make([]artworkIndexPhoto, 0, len(content.Photos))
	for _, photo := range content.Photos {
		width := float64(photo.Width)
		height := float64(photo.Height)
		ratio := 0.0
		if height > 0 {
			ratio = width / height
		}
		photos = append(photos, artworkIndexPhoto{
			Height: height,
			Ratio:  ratio,
			Url:    photo.Url,
			Width:  width,
		})
	}

	tagCompletion := make([]artworkTagCompletion, 0, len(content.Tags))
	for _, tag := range content.Tags {
		tagCompletion = append(tagCompletion, artworkTagCompletion{Input: tag})
	}

	publishedAt := artwork.CreatedOn
	if publishedAt.IsZero() {
		publishedAt = time.Now()
	}

	return artworkIndexDocument{
		ArtworkId:     content.ArtworkId,
		AuthorId:      content.AuthorId,
		From:          content.From,
		Gif:           boolToInt(artwork.IsAnimated || content.IsAnimated == 1),
		Photos:        photos,
		PhotosCnt:     len(photos),
		PublishedDt:   publishedAt.Unix(),
		R18:           artwork.IsR18 || content.IsR18 == 1,
		TagCompletion: tagCompletion,
		Tags:          content.Tags,
		Thumb:         content.Thumb,
		Title:         content.Title,
		Type:          artworkType(len(photos), artwork.IsAnimated || content.IsAnimated == 1),
	}
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func artworkType(photoCount int, animated bool) string {
	if animated {
		return "ugoira"
	}
	if photoCount > 1 {
		return "manga"
	}
	return "illust"
}

package retrieve

import (
	"context"
	"errors"
	"strings"

	"faryne.dev/model/enum"
	"faryne.dev/service/log"
	nekomaidService "faryne.dev/service/nekomaid"
	"faryne.dev/service/nekomaid/nico"
	"faryne.dev/service/nekomaid/pixiv"
	"faryne.dev/service/nekomaid/tinami"
	"go.uber.org/zap"
)

var (
	ErrArguments       = errors.New("site and artwork_id are required")
	ErrUnsupportedSite = errors.New("unsupported site")
)

type Result struct {
	Status string `json:"status"`
	URL    string `json:"url"`
}

type asyncPreviewRetriever interface {
	GetPreview(id string) (previewURL string, async bool, err error)
}

type artworkSaver interface {
	RetrieveAndSave(context.Context, enum.NekomaidSite, string, nekomaidService.RetrieverInterface) (string, error)
}

// Artwork 從來源站抓取作品並存入 Nekomaid；較耗時的 Pixiv 作品沿用既有背景處理。
func Artwork(ctx context.Context, siteValue, artworkID string) (*Result, error) {
	site := enum.NekomaidSite(strings.ToLower(strings.TrimSpace(siteValue)))
	artworkID = strings.TrimSpace(artworkID)
	if site == "" || artworkID == "" {
		return nil, ErrArguments
	}

	retriever, err := newArtworkRetriever(site)
	if err != nil {
		return nil, err
	}
	return artwork(ctx, site, artworkID, retriever, nekomaidService.NewRetriever(), func(task func()) { go task() })
}

func newArtworkRetriever(site enum.NekomaidSite) (nekomaidService.RetrieverInterface, error) {
	switch site {
	case enum.NekomaidSitePixiv:
		return pixiv.New(), nil
	case enum.NekomaidSiteNico:
		return nico.New(), nil
	case enum.NekomaidSiteTinami:
		return tinami.New(), nil
	default:
		return nil, ErrUnsupportedSite
	}
}

func artwork(
	ctx context.Context,
	site enum.NekomaidSite,
	artworkID string,
	retriever nekomaidService.RetrieverInterface,
	saver artworkSaver,
	startBackground func(func()),
) (*Result, error) {
	if previewer, ok := retriever.(asyncPreviewRetriever); ok {
		previewURL, runAsync, err := previewer.GetPreview(artworkID)
		if err != nil {
			return nil, err
		}
		if runAsync {
			startBackground(func() { artworkInBackground(saver, site, artworkID, retriever) })
			return &Result{Status: "queued", URL: previewURL}, nil
		}
	}

	previewURL, err := saver.RetrieveAndSave(ctx, site, artworkID, retriever)
	if err != nil {
		return nil, err
	}
	return &Result{Status: "created", URL: previewURL}, nil
}

func artworkInBackground(saver artworkSaver, site enum.NekomaidSite, artworkID string, retriever nekomaidService.RetrieverInterface) {
	previewURL, err := saver.RetrieveAndSave(context.Background(), site, artworkID, retriever)
	if err != nil {
		log.Logger().Warn("Nekomaid async retrieve failed",
			zap.String("site", string(site)),
			zap.String("artwork_id", artworkID),
			zap.Error(err),
		)
		return
	}
	log.Logger().Info("Nekomaid async retrieve completed",
		zap.String("site", string(site)),
		zap.String("artwork_id", artworkID),
		zap.String("preview_url", previewURL),
	)
}

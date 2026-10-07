package retrieve

import (
	"context"
	"testing"

	nekomaidModel "faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidService "faryne.dev/service/nekomaid"
	"github.com/stretchr/testify/require"
)

type fakeArtworkRetriever struct{}

func (fakeArtworkRetriever) Login() error { return nil }

func (fakeArtworkRetriever) Get(string) (*nekomaidModel.ArtworkMain, error) { return nil, nil }

type fakePreviewArtworkRetriever struct {
	fakeArtworkRetriever
	url      string
	runAsync bool
}

func (r fakePreviewArtworkRetriever) GetPreview(string) (string, bool, error) {
	return r.url, r.runAsync, nil
}

type fakeArtworkSaver struct {
	called    bool
	site      enum.NekomaidSite
	artworkID string
	url       string
}

func (s *fakeArtworkSaver) RetrieveAndSave(_ context.Context, site enum.NekomaidSite, artworkID string, _ nekomaidService.RetrieverInterface) (string, error) {
	s.called, s.site, s.artworkID = true, site, artworkID
	return s.url, nil
}

func TestArtworkRunsSynchronously(t *testing.T) {
	saver := &fakeArtworkSaver{url: "https://neko.maid.tw/nico/author/im123"}
	result, err := artwork(context.Background(), enum.NekomaidSiteNico, "im123", fakeArtworkRetriever{}, saver, func(func()) {
		t.Fatal("synchronous retrieve must not start a background task")
	})

	require.NoError(t, err)
	require.Equal(t, &Result{Status: "created", URL: saver.url}, result)
	require.True(t, saver.called)
	require.Equal(t, enum.NekomaidSiteNico, saver.site)
	require.Equal(t, "im123", saver.artworkID)
}

func TestArtworkQueuesLargePixivArtwork(t *testing.T) {
	saver := &fakeArtworkSaver{url: "https://neko.maid.tw/pixiv/author/123"}
	var task func()
	result, err := artwork(
		context.Background(),
		enum.NekomaidSitePixiv,
		"123",
		fakePreviewArtworkRetriever{url: saver.url, runAsync: true},
		saver,
		func(background func()) { task = background },
	)

	require.NoError(t, err)
	require.Equal(t, &Result{Status: "queued", URL: saver.url}, result)
	require.False(t, saver.called)
	require.NotNil(t, task)
	task()
	require.True(t, saver.called)
}

func TestNewArtworkRetrieverRejectsUnsupportedSite(t *testing.T) {
	_, err := newArtworkRetriever("unsupported")
	require.ErrorIs(t, err, ErrUnsupportedSite)
}

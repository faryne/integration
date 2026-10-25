package sns

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	modelSNS "faryne.dev/model/entity/sns"
)

// stubVtuberVideo 替換影片查詢，測完還原
func stubVtuberVideo(t *testing.T, video *vtuberEntity.VideoDetail, err error) {
	original := fetchVtuberVideo
	fetchVtuberVideo = func(context.Context, string) (*vtuberEntity.VideoDetail, error) { return video, err }
	t.Cleanup(func() { fetchVtuberVideo = original })
}

func TestVtuberVideoMetaEndedLive(t *testing.T) {
	start := time.Date(2026, 10, 24, 1, 0, 0, 0, time.UTC)
	end := start.Add(3*time.Hour + 59*time.Minute)
	stubVtuberVideo(t, &vtuberEntity.VideoDetail{
		VideoID: "abcdefghijk", Title: "【歌枠】秋の夜長", Description: "今日も\n\nありがとう", ThumbnailURL: "https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg",
		ChannelTitle: "Marine Ch.", ChannelHandle: "@houshoumarine", Live: &vtuberEntity.VideoLive{Status: vtuberEntity.LiveStatusEnded, ActualStartAt: &start, ActualEndAt: &end},
	}, nil)

	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/vtubers/@houshoumarine/videos/abcdefghijk"})
	if !strings.HasPrefix(meta.Title, "【歌枠】秋の夜長 | ") {
		t.Fatalf("unexpected title: %q", meta.Title)
	}
	if want := "Marine Ch.・2026/10/24 09:00（台北時間）開播，直播 3 小時 59 分。今日も ありがとう"; meta.Description != want {
		t.Fatalf("unexpected description: %q", meta.Description)
	}
	if meta.Image != "https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg" || meta.Status != 0 {
		t.Fatalf("unexpected image/status: %q %d", meta.Image, meta.Status)
	}
}

func TestVtuberVideoMetaFixesWrongHandle(t *testing.T) {
	stubVtuberVideo(t, &vtuberEntity.VideoDetail{VideoID: "abcdefghijk", Title: "x", ChannelHandle: "@houshoumarine"}, nil)

	// 不帶 @ 視為同一個 handle，canonical 不變
	if meta := BuildMeta(modelSNS.RenderRequest{Path: "data/vtubers/houshoumarine/videos/abcdefghijk"}); !strings.HasSuffix(meta.Canonical, "/data/vtubers/houshoumarine/videos/abcdefghijk") {
		t.Fatalf("handle without @ should keep canonical, got %s", meta.Canonical)
	}
	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/vtubers/@someone/videos/abcdefghijk"})
	if !strings.HasSuffix(meta.Canonical, "/data/vtubers/@houshoumarine/videos/abcdefghijk") || meta.RedirectURL != meta.Canonical {
		t.Fatalf("wrong handle should point canonical to the uploader, got %s / %s", meta.Canonical, meta.RedirectURL)
	}
}

func TestVtuberVideoMetaNotFoundAndError(t *testing.T) {
	stubVtuberVideo(t, nil, nil)
	if meta := BuildMeta(modelSNS.RenderRequest{Path: "data/vtubers/@houshoumarine/videos/abcdefghijk"}); meta.Status != 404 {
		t.Fatalf("missing video should be 404, got %d", meta.Status)
	}

	// 額度用完等暫時性錯誤：維持總覽通用卡，不回 404
	stubVtuberVideo(t, nil, errors.New("quota exceeded"))
	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/vtubers/@houshoumarine/videos/abcdefghijk"})
	if meta.Status != 0 || meta.Description != vtuberDescription {
		t.Fatalf("error should fall back to generic card, got %d %q", meta.Status, meta.Description)
	}
}

// 電視牆是固定路徑，不能被當成 handle 去查藝人（會回 404）
func TestVtuberWallMeta(t *testing.T) {
	original := fetchVtuberChannel
	fetchVtuberChannel = func(string) (*vtuberEntity.ChannelDetail, error) {
		t.Fatal("wall should not look up a channel")
		return nil, nil
	}
	t.Cleanup(func() { fetchVtuberChannel = original })

	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/vtubers/wall"})
	if meta.Status != 0 || !strings.HasPrefix(meta.Title, vtuberWallTitle+" | ") || meta.Description != vtuberWallDescription {
		t.Fatalf("unexpected wall meta: %d %q %q", meta.Status, meta.Title, meta.Description)
	}
}

func TestChineseDuration(t *testing.T) {
	cases := map[time.Duration]string{
		20 * time.Second:           "不到 1 分鐘",
		9 * time.Minute:            "9 分鐘",
		2 * time.Hour:              "2 小時",
		26*time.Hour + time.Minute: "1 天 2 小時",
	}
	for d, want := range cases {
		if got := chineseDuration(d); got != want {
			t.Fatalf("chineseDuration(%v) = %q, want %q", d, got, want)
		}
	}
}

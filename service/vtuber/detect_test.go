package vtuber

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/api/youtube/v3"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

func TestParseRSSVideoIDs(t *testing.T) {
	body, err := os.ReadFile("testdata/rss_marine.xml")
	require.NoError(t, err)
	ids := parseRSSVideoIDs(string(body))
	require.Len(t, ids, 15)
	require.Equal(t, "oCUVQ3S23KA", ids[0])
}

func TestLiveFromVideo(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	video := func(d *youtube.VideoLiveStreamingDetails) *youtube.Video {
		return &youtube.Video{Id: "abcdefghijk", Snippet: &youtube.VideoSnippet{ChannelId: "UCxxx", Title: "【歌枠】"}, LiveStreamingDetails: d}
	}

	// 一般上傳影片：沒有 liveStreamingDetails
	_, ok := liveFromVideo(video(nil), now)
	require.False(t, ok)

	live, ok := liveFromVideo(video(&youtube.VideoLiveStreamingDetails{ScheduledStartTime: "2026-10-23T13:00:00Z"}), now)
	require.True(t, ok)
	require.Equal(t, vtuberEntity.LiveStatusUpcoming, live.Status)
	require.Equal(t, "UCxxx", live.ChannelID)

	live, ok = liveFromVideo(video(&youtube.VideoLiveStreamingDetails{ScheduledStartTime: "2026-10-23T11:00:00Z", ActualStartTime: "2026-10-23T11:02:00Z", ConcurrentViewers: 1234}), now)
	require.True(t, ok)
	require.Equal(t, vtuberEntity.LiveStatusLive, live.Status)
	require.EqualValues(t, 1234, *live.ConcurrentViewers)

	// 已結束：不記同接
	live, ok = liveFromVideo(video(&youtube.VideoLiveStreamingDetails{ActualStartTime: "2026-10-23T09:00:00Z", ActualEndTime: "2026-10-23T10:30:00Z", ConcurrentViewers: 10}), now)
	require.True(t, ok)
	require.Equal(t, vtuberEntity.LiveStatusEnded, live.Status)
	require.Nil(t, live.ConcurrentViewers)

	// フリーチャット：預定在 60 天以後
	_, ok = liveFromVideo(video(&youtube.VideoLiveStreamingDetails{ScheduledStartTime: "2030-01-01T00:00:00Z"}), now)
	require.False(t, ok)
}

func TestCancelledIDs(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	videos := map[string]*youtube.Video{
		"still-there": {Id: "still-there", Snippet: &youtube.VideoSnippet{}, LiveStreamingDetails: &youtube.VideoLiveStreamingDetails{ScheduledStartTime: "2026-10-24T00:00:00Z"}},
		"free-chat":   {Id: "free-chat", Snippet: &youtube.VideoSnippet{}, LiveStreamingDetails: &youtube.VideoLiveStreamingDetails{ScheduledStartTime: "2030-01-01T00:00:00Z"}},
	}
	// 查不到的（轉私人、刪除）與改成フリーチャット的都算取消
	require.Equal(t, []string{"gone", "free-chat"}, cancelledIDs([]string{"still-there", "gone", "free-chat"}, videos, now))
}

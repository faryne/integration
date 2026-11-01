package vtuber

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

func TestLiveHistoryItems(t *testing.T) {
	start := time.Date(2026, 10, 30, 12, 0, 0, 0, time.FixedZone("Asia/Taipei", 8*60*60))
	end := start.Add(2 * time.Hour)
	peak := uint(20000)
	items := liveHistoryItems([]vtuberEntity.Live{
		{VideoID: "a", Title: "【雑談】", ActualStartAt: &start, ActualEndAt: &end, PeakViewers: &peak},
		// 缺結束時間的略過
		{VideoID: "b", ActualStartAt: &start},
	})
	require.Len(t, items, 1)
	require.Equal(t, "a", items[0].VideoID)
	// 時間一律輸出 UTC
	require.Equal(t, time.UTC, items[0].ActualStartAt.Location())
	require.True(t, items[0].ActualEndAt.Equal(end))
	require.EqualValues(t, 20000, *items[0].PeakViewers)
	require.Nil(t, items[0].ViewCount)
}

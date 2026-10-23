package vtuber

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

func TestNormalizeLiveRequest(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	handle := "@houshoumarine"
	channels := []vtuberEntity.Channel{
		{ChannelID: "UCmarine", Title: "Marine Ch. 宝鐘マリン", CustomURL: &handle},
		{ChannelID: "UCpekora", Title: "Pekora Ch. 兎田ぺこら"},
	}

	// 沒給區間：一天前到兩週後
	filter, err := normalizeLiveRequest(vtuberEntity.LiveRequest{}, now, channels)
	require.NoError(t, err)
	require.Equal(t, now.Add(-24*time.Hour), filter.From)
	require.Equal(t, now.Add(14*24*time.Hour), filter.To)

	// 日期視為台北午夜
	filter, err = normalizeLiveRequest(vtuberEntity.LiveRequest{From: "2026-10-23", To: "2026-10-24T00:00:00Z"}, now, channels)
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 10, 22, 16, 0, 0, 0, time.UTC), filter.From.UTC())

	// 關鍵字：名稱片段、handle（可不帶 @）、頻道 ID
	for _, keyword := range []string{"宝鐘", "houshoumarine", "@HoushouMarine", "UCmarine"} {
		filter, err = normalizeLiveRequest(vtuberEntity.LiveRequest{Channel: keyword}, now, channels)
		require.NoError(t, err, keyword)
		require.Equal(t, []string{"UCmarine"}, filter.ChannelIDs, keyword)
	}
	filter, err = normalizeLiveRequest(vtuberEntity.LiveRequest{Channel: "ch."}, now, channels)
	require.NoError(t, err)
	require.Equal(t, []string{"UCmarine", "UCpekora"}, filter.ChannelIDs)

	_, err = normalizeLiveRequest(vtuberEntity.LiveRequest{Channel: "nobody"}, now, channels)
	require.ErrorContains(t, err, "no channel matches")
	_, err = normalizeLiveRequest(vtuberEntity.LiveRequest{Status: "streaming"}, now, channels)
	require.ErrorContains(t, err, "unknown status")
	_, err = normalizeLiveRequest(vtuberEntity.LiveRequest{From: "2026-10-01", To: "2026-11-02"}, now, channels)
	require.ErrorContains(t, err, "at most 31 days")
	_, err = normalizeLiveRequest(vtuberEntity.LiveRequest{From: "2026-10-10", To: "2026-10-01"}, now, channels)
	require.ErrorContains(t, err, "from is after to")
	_, err = normalizeLiveRequest(vtuberEntity.LiveRequest{From: "10/01"}, now, channels)
	require.ErrorContains(t, err, "invalid from")
}

func TestSubscriberDelta(t *testing.T) {
	stats := []vtuberEntity.Stat{
		{RecordDate: "2026-10-01", SubscriberCount: 1000},
		{RecordDate: "2026-10-15", SubscriberCount: 1100},
		{RecordDate: "2026-10-23", SubscriberCount: 1200},
	}
	// 7 天前（10/16）以前最近的一筆是 10/15
	require.EqualValues(t, 1250-1100, *subscriberDelta(stats, 1250, 7))
	// 統計不夠 90 天
	require.Nil(t, subscriberDelta(stats, 1250, 90))
	require.Nil(t, subscriberDelta(nil, 1250, 7))
	// 掉訂閱也要算得出負數
	require.EqualValues(t, -100, *subscriberDelta(stats, 1000, 7))
}

func TestCalendarLinks(t *testing.T) {
	require.Nil(t, calendarLinks(""))
	links := calendarLinks("abc@group.calendar.google.com")
	require.Equal(t, "https://calendar.google.com/calendar/r?cid=abc%40group.calendar.google.com", links.SubscribeURL)
	require.Equal(t, "https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com&ctz=Asia%2FTaipei&mode=AGENDA", links.EmbedURL)
	require.Equal(t, "https://calendar.google.com/calendar/ical/abc@group.calendar.google.com/public/basic.ics", links.ICSURL)
}

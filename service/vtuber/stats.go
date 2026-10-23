package vtuber

import (
	"context"
	"time"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/log"
)

var taipei = time.FixedZone("Asia/Taipei", 8*60*60)

// RecordDailyStats 更新在籍頻道的資訊，並寫入今天（Asia/Taipei）的統計；回傳名稱有變的頻道（channel ID → 新名稱）
func RecordDailyStats(ctx context.Context) (map[string]string, error) {
	channels, err := vtuberRepository.ListActiveChannels()
	if err != nil || len(channels) == 0 {
		return nil, err
	}
	api, err := newYouTubeService(ctx)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(channels))
	for i, ch := range channels {
		ids[i] = ch.ChannelID
	}
	byID, err := listChannelsByIDs(ctx, api, ids)
	if err != nil {
		return nil, err
	}

	today := time.Now().In(taipei).Format(time.DateOnly)
	renamed := make(map[string]string)
	rows := make([]vtuberEntity.Channel, 0, len(channels))
	stats := make([]vtuberEntity.Stat, 0, len(channels))
	for _, old := range channels {
		yt, ok := byID[old.ChannelID]
		if !ok {
			log.Logger().Warn("Vtuber channel not found on youtube", zap.String("channel_id", old.ChannelID))
			continue
		}
		row := channelEntity(yt)
		if row.Title != old.Title {
			renamed[row.ChannelID] = row.Title
		}
		rows = append(rows, row)
		stats = append(stats, vtuberEntity.Stat{ChannelID: row.ChannelID, RecordDate: today, SubscriberCount: row.SubscriberCount, ViewCount: row.ViewCount, VideoCount: row.VideoCount})
	}
	if err := vtuberRepository.UpsertChannels(rows, vtuberRepository.YouTubeColumns); err != nil {
		return nil, err
	}
	return renamed, vtuberRepository.UpsertStats(stats)
}

// RunDailyStats cron 進入點：記統計、同步改名的個人行事曆、清掉 Firebase 中過期的事件記錄
func RunDailyStats() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	renamed, err := RecordDailyStats(ctx)
	if err != nil {
		log.Logger().Error("Record vtuber daily stats failed", zap.Error(err))
	}
	if err := RenameChannelCalendars(ctx, renamed); err != nil {
		log.Logger().Error("Rename vtuber calendars failed", zap.Error(err))
	}
	if err := PruneCalendarEvents(ctx); err != nil {
		log.Logger().Error("Prune vtuber calendar events failed", zap.Error(err))
	}
	log.Logger().Info("Vtuber daily stats finished", zap.Int("renamed", len(renamed)))
}

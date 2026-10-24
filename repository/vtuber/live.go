package vtuber

import (
	"time"

	"gorm.io/gorm/clause"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// LiveFilter 查直播的條件；空字串代表不篩
type LiveFilter struct {
	ChannelIDs []string
	Status     string
	From, To   time.Time
}

// ListTrackingVideoIDs 還沒結束（upcoming／live）的直播，每輪偵測都要重新確認狀態
func ListTrackingVideoIDs() ([]string, error) {
	var out []string
	err := client.GetDB(enum.DBWalolita).Model(&vtuberEntity.Live{}).
		Where("status IN ?", []string{vtuberEntity.LiveStatusUpcoming, vtuberEntity.LiveStatusLive}).
		Pluck("video_id", &out).Error
	return out, err
}

// UpsertLives 以 video_id 為準批次寫入，衝突時整列更新
func UpsertLives(lives []vtuberEntity.Live) error {
	if len(lives) == 0 {
		return nil
	}
	return client.GetDB(enum.DBWalolita).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "video_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"channel_id", "title", "status", "scheduled_start_at", "actual_start_at", "actual_end_at",
			"concurrent_viewers", "thumbnail_url", "checked_at", "updated_at",
		}),
	}).Omit("id").Create(&lives).Error
}

// MarkLivesCancelled YouTube 查不到的直播（轉私人或刪除）標成取消
func MarkLivesCancelled(videoIDs []string, checkedAt time.Time) error {
	if len(videoIDs) == 0 {
		return nil
	}
	return client.GetDB(enum.DBWalolita).Model(&vtuberEntity.Live{}).Where("video_id IN ?", videoIDs).
		Updates(map[string]any{"status": vtuberEntity.LiveStatusCancelled, "concurrent_viewers": nil, "checked_at": checkedAt}).Error
}

// FindLives 查跟區間有重疊的直播，依開始時間（已開播用實際時間，否則用預定時間）由早到晚。
// 重疊＝開始不晚於區間結束，且「還在直播」或「結束（沒結束就看開始）不早於區間開始」；
// 只看開始時間的話，連播超過一天的直播會掉出區間，行事曆結束時間不會更新，總覽也看不到它在直播
func FindLives(filter LiveFilter) ([]vtuberEntity.Live, error) {
	var out []vtuberEntity.Live
	query := client.GetDB(enum.DBWalolita).
		Where("COALESCE(actual_start_at, scheduled_start_at) <= ?", filter.To).
		Where("(status = ? OR COALESCE(actual_end_at, actual_start_at, scheduled_start_at) >= ?)", vtuberEntity.LiveStatusLive, filter.From)
	if len(filter.ChannelIDs) > 0 {
		query = query.Where("channel_id IN ?", filter.ChannelIDs)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	err := query.Order("COALESCE(actual_start_at, scheduled_start_at), id").Find(&out).Error
	return out, err
}

// ListLiveChannelIDs 目前正在直播的頻道
func ListLiveChannelIDs() ([]string, error) {
	var out []string
	err := client.GetDB(enum.DBWalolita).Model(&vtuberEntity.Live{}).
		Where("status = ?", vtuberEntity.LiveStatusLive).Distinct().Pluck("channel_id", &out).Error
	return out, err
}

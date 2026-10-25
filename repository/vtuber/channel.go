package vtuber

import (
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// ScrapedColumns 週更 job（官網名冊＋YouTube 頻道資訊）upsert 時更新的欄位；順便把畢業又回來的頻道復活
var ScrapedColumns = []string{
	"org_slug", "talent_slug", "sort_order", "unit_slug", "is_graduated", "title", "custom_url", "description", "thumbnail_url", "banner_url",
	"trailer_video_id", "channel_published_at", "subscriber_count", "view_count", "video_count", "is_deleted", "deleted_at", "updated_at",
}

// YouTubeColumns 每日統計 job 只更新 YouTube 端的頻道資訊，不碰官網來的 slug／順序／期別
var YouTubeColumns = []string{
	"title", "custom_url", "description", "thumbnail_url", "banner_url",
	"trailer_video_id", "channel_published_at", "subscriber_count", "view_count", "video_count", "updated_at",
}

// ListActiveChannels 未刪除的頻道，依官網順序
func ListActiveChannels() ([]vtuberEntity.Channel, error) {
	var out []vtuberEntity.Channel
	err := client.GetDB(enum.DBWalolita).Where("is_deleted = 0").Order("sort_order, id").Find(&out).Error
	return out, err
}

// GetActiveChannelByHandle 依 @handle 找未刪除的頻道；找不到回 nil
func GetActiveChannelByHandle(handle string) (*vtuberEntity.Channel, error) {
	var out []vtuberEntity.Channel
	err := client.GetDB(enum.DBWalolita).Where("custom_url = ? AND is_deleted = 0", handle).Limit(1).Find(&out).Error
	if err != nil || len(out) == 0 {
		return nil, err
	}
	return &out[0], nil
}

// GetActiveChannelByID 依頻道 ID 找未刪除的頻道；找不到回 nil
func GetActiveChannelByID(channelID string) (*vtuberEntity.Channel, error) {
	var out []vtuberEntity.Channel
	err := client.GetDB(enum.DBWalolita).Where("channel_id = ? AND is_deleted = 0", channelID).Limit(1).Find(&out).Error
	if err != nil || len(out) == 0 {
		return nil, err
	}
	return &out[0], nil
}

// SearchActiveChannels 名稱、@handle、頻道說明含關鍵字，或期別在 unitSlugs 裡的未刪除頻道（含卒業生），依官網順序
func SearchActiveChannels(keyword string, unitSlugs []string, limit int) ([]vtuberEntity.Channel, error) {
	db := client.GetDB(enum.DBWalolita)
	like := "%" + likeEscaper.Replace(keyword) + "%"
	matched := db.Where("title LIKE ?", like).Or("custom_url LIKE ?", like).Or("description LIKE ?", like)
	if len(unitSlugs) > 0 {
		matched = matched.Or("unit_slug IN ?", unitSlugs)
	}
	var out []vtuberEntity.Channel
	err := db.Where("is_deleted = 0").Where(matched).Order("sort_order, id").Limit(limit).Find(&out).Error
	return out, err
}

// likeEscaper 關鍵字裡的 % _ \ 當成一般字元，不是 LIKE 的萬用字元
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// UpsertChannels 以 channel_id 為準批次寫入，衝突時只更新 columns 指定的欄位
func UpsertChannels(channels []vtuberEntity.Channel, columns []string) error {
	if len(channels) == 0 {
		return nil
	}
	return client.GetDB(enum.DBWalolita).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "channel_id"}},
		DoUpdates: clause.AssignmentColumns(columns),
	}).Omit("id").Create(&channels).Error
}

// SoftDeleteChannelsExcept 把不在 keepIDs 裡的在籍頻道標成刪除（畢業），回傳影響筆數
func SoftDeleteChannelsExcept(orgSlug string, keepIDs []string) (int64, error) {
	result := client.GetDB(enum.DBWalolita).Model(&vtuberEntity.Channel{}).
		Where("org_slug = ? AND is_deleted = 0 AND channel_id NOT IN ?", orgSlug, keepIDs).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now()})
	return result.RowsAffected, result.Error
}

// SetChannelCalendars 寫入個人行事曆 ID（channel ID → calendar ID），回傳實際對到的頻道數
func SetChannelCalendars(calendars map[string]string) (int64, error) {
	var total int64
	err := client.GetDB(enum.DBWalolita).Transaction(func(tx *gorm.DB) error {
		for channelID, calendarID := range calendars {
			result := tx.Model(&vtuberEntity.Channel{}).Where("channel_id = ?", channelID).Update("calendar_id", calendarID)
			if result.Error != nil {
				return result.Error
			}
			total += result.RowsAffected
		}
		return nil
	})
	return total, err
}

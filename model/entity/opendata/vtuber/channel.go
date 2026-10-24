package vtuber

import "time"

// OrgHololive 目前唯一的事務所；週更 job 爬官網名冊的頻道都掛在這裡
const OrgHololive = "hololive"

// Channel 對應 vtuber_channels：週更 job 從官網爬名冊，每日統計 job 更新頻道資訊與最新數字
type Channel struct {
	ID                 uint       `gorm:"column:id;primaryKey"`
	ChannelID          string     `gorm:"column:channel_id"`
	OrgSlug            string     `gorm:"column:org_slug;default:hololive"` // 所屬事務所；名冊清理只限同一家。沒填時用 DB 預設，不會寫成空字串
	TalentSlug         string     `gorm:"column:talent_slug"`               // 官網藝人頁 /talents/<slug>/
	SortOrder          uint       `gorm:"column:sort_order"`                // 官網列表頁順序
	UnitSlug           *string    `gorm:"column:unit_slug"`                 // 官網分組，例如 gen-3、myth
	Title              string     `gorm:"column:title"`
	CustomURL          *string    `gorm:"column:custom_url"` // @handle
	Description        *string    `gorm:"column:description"`
	ThumbnailURL       string     `gorm:"column:thumbnail_url"`
	BannerURL          string     `gorm:"column:banner_url"`
	TrailerVideoID     *string    `gorm:"column:trailer_video_id"`
	ChannelPublishedAt *time.Time `gorm:"column:channel_published_at"`
	SubscriberCount    uint64     `gorm:"column:subscriber_count"`
	ViewCount          uint64     `gorm:"column:view_count"`
	VideoCount         uint64     `gorm:"column:video_count"`
	CalendarID         *string    `gorm:"column:calendar_id"`  // 個人 Google 行事曆；週更／每日 job 的 upsert 不會覆蓋這欄
	IsGraduated        bool       `gorm:"column:is_graduated"` // 在官網卒業生分組裡；期別仍是原本的
	IsDeleted          bool       `gorm:"column:is_deleted"`
	DeletedAt          *time.Time `gorm:"column:deleted_at"`
	CreatedAt          time.Time  `gorm:"column:created_at"`
	UpdatedAt          time.Time  `gorm:"column:updated_at"`
}

func (Channel) TableName() string {
	return "vtuber_channels"
}

// Calendar 回傳個人行事曆 ID，還沒有時回空字串
func (c Channel) Calendar() string {
	if c.CalendarID == nil {
		return ""
	}
	return *c.CalendarID
}

// Handle 回傳 @handle，沒有時回空字串
func (c Channel) Handle() string {
	if c.CustomURL == nil {
		return ""
	}
	return *c.CustomURL
}

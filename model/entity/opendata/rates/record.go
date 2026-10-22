package rates

import "time"

// RateRecord 爬蟲寫入 rates 表用的資料列。
// 實際資料是 base＝外幣、to＝TWD（跟欄位註解寫的方向相反，以資料為準）。
// RecordDate 存 YYYY-MM-DD 字串，避免 DSN 時區設定把台灣午夜轉成前一天。
type RateRecord struct {
	ServiceName string  `gorm:"column:service_name"`
	Base        string  `gorm:"column:base"`
	To          string  `gorm:"column:to"`
	BuyRate     float64 `gorm:"column:buy_rate"`  // 現鈔銀行買入
	SellRate    float64 `gorm:"column:sell_rate"` // 現鈔銀行賣出
	RecordDate  string  `gorm:"column:record_date"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (RateRecord) TableName() string {
	return "rates"
}

package rates

import (
	"faryne.dev/model/entity"
	"time"
)

type RateRequest struct {
	ServiceName string                `json:"service_name" query:"service_name"`
	BeginDate   entity.OnlyDateFormat `json:"begin_date" query:"begin_date"`
	EndDate     entity.OnlyDateFormat `json:"end_date" query:"end_date"`
	Currencies  []string              `json:"currencies" query:"currencies"`
}

type Rate struct {
	Id          uint                  `json:"id"`           // 對應 id
	ServiceName string                `json:"service_name"` // 對應 service_name
	Base        string                `json:"base"`         // 對應 base
	To          string                `json:"to"`           // 對應 to
	BuyRate     float64               `json:"buy_rate"`     // 對應 buy_rate
	SellRate    float64               `json:"sell_rate"`    // 對應 sell_rate
	RecordDate  entity.OnlyDateFormat `json:"record_date"`  // 對應 record_date, YYYY-mm-dd
	CreatedAt   time.Time             `json:"-"`            // 對應 created_at, 可為空
	UpdatedAt   time.Time             `json:"-"`            // 對應 updated_at, 可為空
}

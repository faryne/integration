package etf

import (
	"time"

	"faryne.dev/model/enum"
)

type ETF struct {
	Date             string           `json:"date,omitempty" gorm:"column:publish_date"` // 發行日，抓回來時要把「.」轉換為「-」
	Code             string           `json:"code" gorm:"column:code"`
	Name             string           `json:"name"`
	Company          string           `json:"company,omitempty"`
	Target           string           `json:"target,omitempty"`
	Market           enum.StockMarket `json:"market,omitempty"` // twse / otc
	CreatedAt        time.Time        `json:"-" gorm:"column:created_at"`
	UpdatedAt        time.Time        `json:"-" gorm:"column:updated_at"`
	TotalExCount     int64            `json:"total_ex_count"`     // 總共除權除息次數
	SuccessFillCount int64            `json:"success_fill_count"` // 成功填息次數
	WinRate          float64          `json:"win_rate"`           // 勝率，  0 <= N <= 100
	AvgFillDays      float64          `json:"avg_fill_days"`      // 平均填息日
	ExDate           time.Time        `json:"ex_date" gorm:"->"`
	Share            float64          `json:"share" gorm:"->"`
	PayableDate      string           `json:"payable_date" gorm:"->"`
}

func (e *ETF) TableName() string {
	return "etf_codes"
}

type Ticker struct {
	Date      string    `json:"date" gorm:"column:ticker_date"`
	Code      string    `json:"code" gorm:"column:code"`
	Open      float64   `json:"open"`
	Max       float64   `json:"max"`
	Min       float64   `json:"min"`
	Close     float64   `json:"close"`
	CreatedAt time.Time `json:"-" gorm:"column:created_at"`
	UpdatedAt time.Time `json:"-" gorm:"column:updated_at"`
}

func (t *Ticker) TableName() string {
	return "etf_tickers"
}

type Share struct {
	Id                int64     `json:"id"`
	Code              string    `json:"code" gorm:"column:code"`
	ExDate            string    `json:"ex_date"`
	PayableDate       string    `json:"payable_date"`
	Share             float64   `json:"share"`
	CreatedAt         time.Time `json:"-" gorm:"column:created_at"`
	UpdatedAt         time.Time `json:"-" gorm:"column:updated_at"`
	ExTickerPrice     float64   `json:"ex_ticker_price" gorm:"column:ex_ticker_price"`         // 除權息前收盤價，從 etf_tickers 找
	YieldRate         float64   `json:"yield_rate"`                                            // 單次殖利率
	FilledDate        string    `json:"filled_date"`                                           // 填息日
	FilledTickerPrice float64   `json:"filled_ticker_price" gorm:"column:filled_ticker_price"` // 填息日收盤價，從 etf_ticker 找
	FilledDays        int64     `json:"filled_days"`                                           // 填息天數（日曆天數）
	FilledTradeDays   int64     `json:"filled_trade_days"`                                     // 填息交易日數（交易日）
}

type ShareWithETFAndStats struct {
	ETF   `json:"etf"`
	Stats []Share `json:"stats"`
}

func (s *Share) TableName() string {
	return "etf_shares"
}

type MonthlyPrice struct {
	Id        int64     `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	Code      string    `json:"code" gorm:"column:code" validate:"required"`
	Year      int       `json:"year" gorm:"column:year" validate:"required"`
	Month     int       `json:"month" gorm:"column:month" validate:"required"`
	AvgPrice  float64   `json:"avg_price" gorm:"column:avg_price" validate:"required"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at"`
}

func (m *MonthlyPrice) TableName() string {
	return "etf_monthly_prices"
}

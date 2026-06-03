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
	TotalExCount     int64            `json:"total_ex_count"`                          // 總共除權除息次數
	SuccessFillCount int64            `json:"success_fill_count"`                      // 成功填息次數
	WinRate          float64          `json:"win_rate"`                                // 勝率，  0 <= N <= 100
	AvgFillDays      float64          `json:"avg_fill_days"`                           // 平均填息日
	RangePosition    float64          `json:"range_position"`                          // 近一個月收盤價區間位置
	LatestClose      float64          `json:"latest_close" gorm:"column:latest_close"` // 最新收盤價
	MA5              float64          `json:"ma5" gorm:"column:ma5"`
	MA20             float64          `json:"ma20" gorm:"column:ma20"`
	MA20BiasRate     float64          `json:"ma20_bias_rate" gorm:"column:ma20_bias_rate"` // 收盤價相對 MA20 乖離率
	ExDate           time.Time        `json:"ex_date" gorm:"->"`
	Share            float64          `json:"share" gorm:"->"`
	PayableDate      string           `json:"payable_date" gorm:"->"`
}

func (e *ETF) TableName() string {
	return "etf_codes"
}

type Ticker struct {
	Date             string    `json:"date" gorm:"column:ticker_date"`
	Code             string    `json:"code" gorm:"column:code"`
	Open             float64   `json:"open"`
	Max              float64   `json:"max"`
	Min              float64   `json:"min"`
	Close            float64   `json:"close"`
	RangePosition20  float64   `json:"range_position_20" gorm:"column:range_position_20"`
	RangePosition60  float64   `json:"range_position_60" gorm:"column:range_position_60"`
	RangePosition120 float64   `json:"range_position_120" gorm:"column:range_position_120"`
	MA5              float64   `json:"ma5" gorm:"column:ma5"`
	MA20             float64   `json:"ma20" gorm:"column:ma20"`
	MA60             float64   `json:"ma60" gorm:"column:ma60"`
	MA120            float64   `json:"ma120" gorm:"column:ma120"`
	Volume           int64     `json:"volume"`
	TradingMoney     int64     `json:"trading_money" gorm:"column:trading_money"`
	TradingTurnover  int64     `json:"trading_turnover" gorm:"column:trading_turnover"`
	CreatedAt        time.Time `json:"-" gorm:"column:created_at"`
	UpdatedAt        time.Time `json:"-" gorm:"column:updated_at"`
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

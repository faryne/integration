package etf

import "time"

type ETF struct {
	Date             string    `json:"date,omitempty" gorm:"column:publish_date"` // 發行日，抓回來時要把「.」轉換為「-」
	Code             string    `json:"code" gorm:"column:code"`
	Name             string    `json:"name"`
	Company          string    `json:"company,omitempty"`
	Target           string    `json:"target,omitempty"`
	Market           string    `json:"market,omitempty"` // twse / otc
	CreatedAt        time.Time `json:"-" gorm:"column:created_at"`
	UpdatedAt        time.Time `json:"-" gorm:"column:updated_at"`
	TotalExCount     int64     `json:"total_ex_count"`     // 總共除權除息次數
	SuccessFillCount int64     `json:"success_fill_count"` // 成功填息次數
	WinRate          float64   `json:"win_rate"`           // 勝率，  0 <= N <= 100
	AvgFillDays      float64   `json:"avg_fill_days"`      // 平均填息日
}

func (e *ETF) TableName() string {
	return "etf_codes"
}

type WithRecentShareETF struct {
	ETF
	ExDate      string  `json:"ex_date"`
	PayableDate string  `json:"payable_date"`
	Share       float64 `json:"share"`
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
	Code        string    `json:"code" gorm:"column:code"`
	ExDate      string    `json:"ex_date"`
	PayableDate string    `json:"payable_date"`
	Share       float64   `json:"share"`
	CreatedAt   time.Time `json:"-" gorm:"column:created_at"`
	UpdatedAt   time.Time `json:"-" gorm:"column:updated_at"`
}

func (s *Share) TableName() string {
	return "etf_shares"
}

// WinRateStats 計算勝率等資訊使用的 view
type WinRateStats struct {
	Code             string  `json:"code"`
	ExDate           string  `json:"ex_date"`            // 除權息日
	DividendAmount   float64 `json:"dividend_amount"`    // 配息
	PayableDate      string  `json:"payable_date"`       // 入帳日
	PreExClosePrice  float64 `json:"pre_ex_close_price"` // 除權息前收盤價
	YieldRate        float64 `json:"yield_rate"`         // 單次殖利率
	FilledDate       string  `json:"filled_date"`        // 填息日
	FilledClosePrice float64 `json:"filled_close_price"` // 填息日收盤價
	FilledDays       int64   `json:"filled_days"`        // 填息天數（日曆天數）
	FilledTradeDays  int64   `json:"filled_trade_days"`  // 填息交易日數（交易日）
}

func (w *WinRateStats) TableName() string {
	return "view_etf_win_rate_stats"
}

type WinRate struct {
	Code             string  `json:"code"`
	TotalExCount     int64   `json:"total_ex_count"`     // 總除權息次數
	SuccessFillCount int64   `json:"success_fill_count"` // 成功填息次數
	WinRate          float64 `json:"win_rate"`           // 填息勝率
	AvgFillDays      float64 `json:"avg_fill_days"`      // 平均填息天數
}

type ShareWithWinRate struct {
	Stats   []WinRateStats `json:"stats"`
	WinRate `json:"win_rate"`
}

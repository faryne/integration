package etf

import "time"

type Code struct {
	Code string `json:"code" gorm:"column:code"`
}

type ETF struct {
	Date      string    `json:"date,omitempty" gorm:"column:publish_date"` // 發行日，抓回來時要把「.」轉換為「-」
	Code      string    `json:"code" gorm:"column:code"`
	Name      string    `json:"name"`
	Company   string    `json:"company,omitempty"`
	Target    string    `json:"target,omitempty"`
	Market    string    `json:"market,omitempty"` // twse / otc
	CreatedAt time.Time `json:"-" gorm:"column:created_at"`
	UpdatedAt time.Time `json:"-" gorm:"column:updated_at"`
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

package av

import (
	"fmt"
	"time"
)

// joyu.fyi 女優股市（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）

const (
	StockListed   = "listed"
	StockDelisted = "delisted"
)

// JoyuStock 一檔上市的女優；金額欄位單位是「分」（1 單位 = 100）
type JoyuStock struct {
	ID          int     `gorm:"column:id;primaryKey"`
	Domain      string  `gorm:"column:domain"`
	AID         int     `gorm:"column:aid"`
	Name        string  `gorm:"column:name"`
	Status      string  `gorm:"column:status"`
	Fundamental float64 `gorm:"column:fundamental"`
	// OpenFundamental 今天開盤時的 F，基本面單日變動上限的基準（收盤時更新成當下的 F）
	OpenFundamental float64 `gorm:"column:open_fundamental"`
	SharesOut       int64   `gorm:"column:shares_out"`
	// ShareCap 發行上限：流通股數最多到這裡（預設 100000，之後依看過／評分／想看／買單等人氣指標動態調整）
	ShareCap   int64      `gorm:"column:share_cap"`
	LastPrice  int64      `gorm:"column:last_price"`
	PrevClose  int64      `gorm:"column:prev_close"`
	Videos90d  int        `gorm:"column:videos_90d"`
	ListedAt   time.Time  `gorm:"column:listed_at"`
	DelistedAt *time.Time `gorm:"column:delisted_at"`
	CreatedAt  time.Time  `gorm:"column:created_at"`
	UpdatedAt  time.Time  `gorm:"column:updated_at"`
}

func (JoyuStock) TableName() string {
	return "joyu_stocks"
}

// StockCode 代碼由 id 推出來（J0001…），不另外存
func StockCode(id int) string {
	return fmt.Sprintf("J%04d", id)
}

// StockIDFromCode 代碼轉回 id；格式不對回 0
func StockIDFromCode(code string) int {
	var id int
	if n, err := fmt.Sscanf(code, "J%d", &id); n != 1 || err != nil || id <= 0 || StockCode(id) != code {
		return 0
	}
	return id
}

// MarketStock 股市 API 回傳的一檔：價格換成單位（小數兩位），附上女優照片供列表顯示
type MarketStock struct {
	Code   string  `json:"code"`
	Domain string  `json:"domain"`
	AID    int     `json:"aid"`
	Name   string  `json:"name"`
	Photo  string  `json:"photo"`
	Status string  `json:"status"`
	Price  float64 `json:"price"`
	// Fundamental 基本價 F：股價 = F × (1 + 流通股數 ÷ 20000)，沒人持股時股價就是 F
	Fundamental float64   `json:"fundamental"`
	PrevClose   float64   `json:"prev_close"`
	SharesOut   int64     `json:"shares_out"`
	ShareCap    int64     `json:"share_cap"` // 發行上限
	Videos90d   int       `json:"videos_90d"`
	Volume      int64     `json:"volume"`      // 今天的成交股數
	BuyVolume   int64     `json:"buy_volume"`  // 今天買進的股數
	SellVolume  int64     `json:"sell_volume"` // 今天賣出的股數
	BuyCount    int64     `json:"buy_count"`   // 今天的買單數（成交筆數）
	SellCount   int64     `json:"sell_count"`  // 今天的賣單數
	ListedAt    time.Time `json:"listed_at"`
}

// MarketStockDetail 個股頁：報價＋最近成交（不顯示是誰）
type MarketStockDetail struct {
	MarketStock
	RecentTrades []MarketRecentTrade `json:"recent_trades"`
}

// MarketRecentTrade 個股頁的一筆成交；Price 是成交後的股價
type MarketRecentTrade struct {
	Side   string  `json:"side"`
	Shares int64   `json:"shares"`
	Price  float64 `json:"price"`
	// Fundamental 基本價 F：股價 = F × (1 + 流通股數 ÷ 20000)，沒人持股時股價就是 F
	Fundamental float64   `json:"fundamental"`
	CreatedAt   time.Time `json:"created_at"`
}

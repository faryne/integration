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
	ID          int        `gorm:"column:id;primaryKey"`
	Domain      string     `gorm:"column:domain"`
	AID         int        `gorm:"column:aid"`
	Name        string     `gorm:"column:name"`
	Status      string     `gorm:"column:status"`
	Fundamental float64    `gorm:"column:fundamental"`
	SharesOut   int64      `gorm:"column:shares_out"`
	LastPrice   int64      `gorm:"column:last_price"`
	PrevClose   int64      `gorm:"column:prev_close"`
	Videos90d   int        `gorm:"column:videos_90d"`
	ListedAt    time.Time  `gorm:"column:listed_at"`
	DelistedAt  *time.Time `gorm:"column:delisted_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
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
	Code      string    `json:"code"`
	Domain    string    `json:"domain"`
	AID       int       `json:"aid"`
	Name      string    `json:"name"`
	Photo     string    `json:"photo"`
	Status    string    `json:"status"`
	Price     float64   `json:"price"`
	PrevClose float64   `json:"prev_close"`
	SharesOut int64     `json:"shares_out"`
	Videos90d int       `json:"videos_90d"`
	Volume    int64     `json:"volume"` // 今天的成交股數
	ListedAt  time.Time `json:"listed_at"`
}

// MarketStockDetail 個股頁：報價＋最近成交（不顯示是誰）
type MarketStockDetail struct {
	MarketStock
	RecentTrades []MarketRecentTrade `json:"recent_trades"`
}

// MarketRecentTrade 個股頁的一筆成交；Price 是成交後的股價
type MarketRecentTrade struct {
	Side      string    `json:"side"`
	Shares    int64     `json:"shares"`
	Price     float64   `json:"price"`
	CreatedAt time.Time `json:"created_at"`
}

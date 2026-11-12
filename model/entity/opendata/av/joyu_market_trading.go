package av

import "time"

// joyu 女優股市 P2：錢包、持股、成交、每日價格。金額欄位單位是「分」

const (
	TradeBuy  = "buy"
	TradeSell = "sell"
	// TradeCounterpartySystem 對手是系統造市；之後開放使用者撮合時記對方 uid
	TradeCounterpartySystem = "system"
	// TradeCounterpartyDelist 下市時照最後價格現金買回（不收手續費）
	TradeCounterpartyDelist = "delist"
)

type JoyuWallet struct {
	FirebaseUID string    `gorm:"column:firebase_uid;primaryKey"`
	Cash        int64     `gorm:"column:cash"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

func (JoyuWallet) TableName() string { return "joyu_wallets" }

// JoyuHolding 一個人在一檔的持股；TodayBought 是 TodayDate 那天買的（T+1：隔天才能賣）
type JoyuHolding struct {
	FirebaseUID string     `gorm:"column:firebase_uid;primaryKey"`
	StockID     int        `gorm:"column:stock_id;primaryKey"`
	Shares      int64      `gorm:"column:shares"`
	Cost        int64      `gorm:"column:cost"`
	TodayBought int64      `gorm:"column:today_bought"`
	TodayDate   *time.Time `gorm:"column:today_date;type:date"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

func (JoyuHolding) TableName() string { return "joyu_holdings" }

// Sellable 可賣股數：今天買的不能賣
func (h JoyuHolding) Sellable(today string) int64 {
	if h.TodayDate != nil && h.TodayDate.Format(time.DateOnly) == today {
		return h.Shares - h.TodayBought
	}
	return h.Shares
}

type JoyuTrade struct {
	ID           int64     `gorm:"column:id;primaryKey"`
	FirebaseUID  string    `gorm:"column:firebase_uid"`
	StockID      int       `gorm:"column:stock_id"`
	Side         string    `gorm:"column:side"`
	Shares       int64     `gorm:"column:shares"`
	Amount       int64     `gorm:"column:amount"`
	Fee          int64     `gorm:"column:fee"`
	PriceAfter   int64     `gorm:"column:price_after"`
	Counterparty string    `gorm:"column:counterparty"`
	CreatedAt    time.Time `gorm:"column:created_at"`
}

func (JoyuTrade) TableName() string { return "joyu_trades" }

// MarketTradeRequest 下單：Limit 是報價時的合計（分），買的實際合計超過、賣的實際入帳低於它就拒單（價格在這中間動了）
type MarketTradeRequest struct {
	Side   string `json:"side"`
	Shares int64  `json:"shares"`
	Limit  int64  `json:"limit"`
}

// MarketQuote 報價（單位）：Total 是買要付／賣會入帳的合計，TotalCents 原樣帶回下單當 Limit；
// MaxShares 是現在最多能買／賣幾股（受現金、可賣股數、漲跌停限制）
type MarketQuote struct {
	Side       string  `json:"side"`
	Shares     int64   `json:"shares"`
	Amount     float64 `json:"amount"`
	Fee        float64 `json:"fee"`
	Total      float64 `json:"total"`
	TotalCents int64   `json:"total_cents"`
	PriceAfter float64 `json:"price_after"`
	MaxShares  int64   `json:"max_shares"`
}

// MarketHolding 我的持股的一檔
type MarketHolding struct {
	Stock    MarketStock `json:"stock"`
	Shares   int64       `json:"shares"`
	Sellable int64       `json:"sellable"`
	Cost     float64     `json:"cost"`
}

// MarketWallet 我的資產：現金、持股市值（照現價算）、總資產與報酬率（相對開戶的 100000）
type MarketWallet struct {
	Cash          float64         `json:"cash"`
	HoldingsValue float64         `json:"holdings_value"`
	Total         float64         `json:"total"`
	ReturnPct     float64         `json:"return_pct"`
	Rank          int64           `json:"rank"` // 總資產排名
	Holdings      []MarketHolding `json:"holdings"`
}

// MarketTradeRow 成交紀錄的一筆
type MarketTradeRow struct {
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Side      string    `json:"side"`
	Shares    int64     `json:"shares"`
	Amount    float64   `json:"amount"`
	Fee       float64   `json:"fee"`
	CreatedAt time.Time `json:"created_at"`
}

// JoyuStockDaily 一檔一天的開高低收與成交量（台灣時間 00:00 切日）
type JoyuStockDaily struct {
	StockID int       `gorm:"column:stock_id;primaryKey"`
	Date    time.Time `gorm:"column:date;primaryKey;type:date"`
	Open    int64     `gorm:"column:open"`
	High    int64     `gorm:"column:high"`
	Low     int64     `gorm:"column:low"`
	Close   int64     `gorm:"column:close"`
	Volume  int64     `gorm:"column:volume"`
}

func (JoyuStockDaily) TableName() string { return "joyu_stock_daily" }

// MarketPricePoint 走勢圖的一天（收盤價、成交量）
type MarketPricePoint struct {
	Date   string  `json:"date"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
}

// MarketLeader 排行榜的一列（不帶 uid）：暱稱沒設的顯示匿名代號；TopCode／TopName 是市值最大的持股（沒持股是空字串）
type MarketLeader struct {
	Rank      int     `json:"rank"`
	Name      string  `json:"name"`
	Total     float64 `json:"total"`
	ReturnPct float64 `json:"return_pct"`
	TopCode   string  `json:"top_code"`
	TopName   string  `json:"top_name"`
}

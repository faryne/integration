package etf

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ProfitTransaction 對應前端試算盈虧階段式算法的單筆購入批次（含可選的賣出資訊），
// JSON tag 直接對齊前端 Transaction 型別的 camelCase 欄位名。
type ProfitTransaction struct {
	ID         string  `json:"id"`
	BuyDate    string  `json:"buyDate"`
	BuyShares  float64 `json:"buyShares"`
	BuyPrice   float64 `json:"buyPrice"`
	IsSold     bool    `json:"isSold"`
	SellDate   string  `json:"sellDate"`
	SellShares float64 `json:"sellShares"`
	SellPrice  float64 `json:"sellPrice"`
}

type ProfitTransactions []ProfitTransaction

func (t ProfitTransactions) Value() (driver.Value, error) {
	if t == nil {
		return "[]", nil
	}
	data, err := json.Marshal(t)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (t *ProfitTransactions) Scan(value any) error {
	if value == nil {
		*t = nil
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into ProfitTransactions", value)
	}
	if len(data) == 0 {
		*t = nil
		return nil
	}
	return json.Unmarshal(data, t)
}

// SavedTransaction 是使用者在試算盈虧頁面同意儲存的階段式交易紀錄，整包覆蓋式儲存，
// 一個 (user_id, code) 只有一列。
type SavedTransaction struct {
	Id        uint64             `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    uint64             `json:"-" gorm:"column:user_id"`
	Code      string             `json:"code" gorm:"column:code"`
	Records   ProfitTransactions `json:"records" gorm:"column:records;type:json"`
	DeletedAt *time.Time         `json:"-" gorm:"column:deleted_at"`
	CreatedAt time.Time          `json:"-" gorm:"column:created_at"`
	UpdatedAt time.Time          `json:"updated_at" gorm:"column:updated_at"`
}

func (s *SavedTransaction) TableName() string {
	return "etf_saved_transactions"
}

type SaveTransactionsRequest struct {
	Records ProfitTransactions `json:"records"`
}

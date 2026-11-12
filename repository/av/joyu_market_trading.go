package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// joyu 女優股市的交易資料（錢包、持股、成交、每日價格）。交易一律在 primary 的 transaction 裡做，
// 鎖的順序固定是 stock → wallet → holding，避免兩筆交易互相等待（死結）

type RepositoryJoyuMarket struct {
	db *gorm.DB
}

func NewJoyuMarket() *RepositoryJoyuMarket {
	return &RepositoryJoyuMarket{db: client.GetDB(enum.DBWalolita)}
}

func (r *RepositoryJoyuMarket) primary() *gorm.DB {
	return r.db.Clauses(dbresolver.Write)
}

// Transaction 交易用的 transaction（primary）
func (r *RepositoryJoyuMarket) Transaction(fn func(tx *gorm.DB) error) error {
	return r.primary().Transaction(fn)
}

var forUpdate = clause.Locking{Strength: "UPDATE"}

// LockStock 鎖住一檔（交易、刪帳號時改 S 與現價）
func (r *RepositoryJoyuMarket) LockStock(tx *gorm.DB, id int) (*av.JoyuStock, error) {
	var row av.JoyuStock
	if err := tx.Clauses(forUpdate).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// LockWallet 鎖住錢包；沒開戶回 gorm.ErrRecordNotFound
func (r *RepositoryJoyuMarket) LockWallet(tx *gorm.DB, uid string) (*av.JoyuWallet, error) {
	var row av.JoyuWallet
	if err := tx.Clauses(forUpdate).Where("firebase_uid = ?", uid).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// LockHolding 鎖住持股；沒有持股回空的一筆（Shares=0）
func (r *RepositoryJoyuMarket) LockHolding(tx *gorm.DB, uid string, stockID int) (av.JoyuHolding, error) {
	var rows []av.JoyuHolding
	err := tx.Clauses(forUpdate).Where("firebase_uid = ? AND stock_id = ?", uid, stockID).Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return av.JoyuHolding{FirebaseUID: uid, StockID: stockID}, err
	}
	return rows[0], nil
}

// SaveHolding 寫回持股；賣光就刪掉那一列
func (r *RepositoryJoyuMarket) SaveHolding(tx *gorm.DB, h av.JoyuHolding) error {
	if h.Shares <= 0 {
		return tx.Where("firebase_uid = ? AND stock_id = ?", h.FirebaseUID, h.StockID).Delete(&av.JoyuHolding{}).Error
	}
	return tx.Save(&h).Error
}

// SetStockPrice 交易後的流通股數與現價
func (r *RepositoryJoyuMarket) SetStockPrice(tx *gorm.DB, id int, sharesOut, price int64) error {
	return tx.Model(&av.JoyuStock{}).Where("id = ?", id).Updates(map[string]any{"shares_out": sharesOut, "last_price": price}).Error
}

// SetFundamental 基本面重算後的 F、現價與近 90 天部數
func (r *RepositoryJoyuMarket) SetFundamental(tx *gorm.DB, id int, f float64, price int64, videos90d int) error {
	return tx.Model(&av.JoyuStock{}).Where("id = ?", id).
		Updates(map[string]any{"fundamental": f, "last_price": price, "videos_90d": videos90d}).Error
}

func (r *RepositoryJoyuMarket) SetCash(tx *gorm.DB, uid string, cash int64) error {
	return tx.Model(&av.JoyuWallet{}).Where("firebase_uid = ?", uid).Update("cash", cash).Error
}

func (r *RepositoryJoyuMarket) InsertTrade(tx *gorm.DB, t *av.JoyuTrade) error {
	return tx.Create(t).Error
}

// AddDaily 把一筆成交記進當天的開高低收與成交量：當天第一筆時開盤價是成交前的價格
func (r *RepositoryJoyuMarket) AddDaily(tx *gorm.DB, stockID int, date string, before, after, volume int64) error {
	return tx.Exec(`INSERT INTO joyu_stock_daily (stock_id, date, open, high, low, close, volume, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
ON DUPLICATE KEY UPDATE high = GREATEST(high, VALUES(high)), low = LEAST(low, VALUES(low)), close = VALUES(close),
  volume = volume + VALUES(volume), updated_at = NOW()`,
		stockID, date, before, max(before, after), min(before, after), after, volume).Error
}

// EnsureWallet 開戶：沒有錢包才建，入帳 cash（已經有就不動）
func (r *RepositoryJoyuMarket) EnsureWallet(uid string, cash int64) error {
	now := time.Now()
	return r.primary().Clauses(clause.OnConflict{DoNothing: true}).
		Create(&av.JoyuWallet{FirebaseUID: uid, Cash: cash, CreatedAt: now, UpdatedAt: now}).Error
}

func (r *RepositoryJoyuMarket) Wallet(uid string) (*av.JoyuWallet, error) {
	var row av.JoyuWallet
	if err := r.primary().Where("firebase_uid = ?", uid).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// Holdings 一個人的全部持股
func (r *RepositoryJoyuMarket) Holdings(uid string) ([]av.JoyuHolding, error) {
	var rows []av.JoyuHolding
	err := r.primary().Where("firebase_uid = ?", uid).Find(&rows).Error
	return rows, err
}

// Holding 一個人在一檔的持股（個股頁報價用）；沒有就回 Shares=0
func (r *RepositoryJoyuMarket) Holding(uid string, stockID int) (av.JoyuHolding, error) {
	return r.LockHolding(r.primary(), uid, stockID)
}

// TradesByUID 一個人的成交紀錄，新的在前
func (r *RepositoryJoyuMarket) TradesByUID(uid string, page, size int) ([]av.JoyuTrade, int64, error) {
	var rows []av.JoyuTrade
	var total int64
	q := r.primary().Model(&av.JoyuTrade{}).Where("firebase_uid = ?", uid)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Order("id DESC").Offset((page - 1) * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

// RecentTrades 一檔最近的成交（個股頁，不顯示是誰）
func (r *RepositoryJoyuMarket) RecentTrades(stockID, size int) ([]av.JoyuTrade, error) {
	var rows []av.JoyuTrade
	err := r.primary().Where("stock_id = ?", stockID).Order("id DESC").Limit(size).Find(&rows).Error
	return rows, err
}

// DailyVolumes 某天各檔的成交量（股市總覽）
func (r *RepositoryJoyuMarket) DailyVolumes(date string) (map[int]int64, error) {
	var rows []struct {
		StockID int
		Volume  int64
	}
	if err := r.db.Table("joyu_stock_daily").Select("stock_id, volume").Where("date = ?", date).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[int]int64, len(rows))
	for _, row := range rows {
		out[row.StockID] = row.Volume
	}
	return out, nil
}

// CloseDay 收盤：每檔上市股補齊 date 那天的價格紀錄（沒成交的開高低收都是現價），收盤價寫進昨收。
// 兩步都可以重跑（第一步是 upsert、第二步是把現價複製過去）
func (r *RepositoryJoyuMarket) CloseDay(date string) error {
	return r.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`INSERT INTO joyu_stock_daily (stock_id, date, open, high, low, close, volume, created_at, updated_at)
SELECT id, ?, last_price, last_price, last_price, last_price, 0, NOW(), NOW() FROM joyu_stocks WHERE status = ?
ON DUPLICATE KEY UPDATE close = VALUES(close), updated_at = NOW()`, date, av.StockListed).Error; err != nil {
			return err
		}
		return tx.Exec("UPDATE joyu_stocks SET prev_close = last_price, updated_at = NOW() WHERE status = ?", av.StockListed).Error
	})
}

// DelistStock 下市：每位持有人的持股照現價現金買回（不收手續費，成交紀錄記 counterparty=delist），
// 刪掉持股、流通股數歸零、狀態改成已下市。先鎖 stock，碰這檔持股的交易都會在 stock 上排隊，不會跟這裡互卡
func (r *RepositoryJoyuMarket) DelistStock(id int) error {
	return r.Transaction(func(tx *gorm.DB) error {
		s, err := r.LockStock(tx, id)
		if err != nil || s.Status != av.StockListed {
			return err
		}
		var holdings []av.JoyuHolding
		if err := tx.Clauses(forUpdate).Where("stock_id = ?", id).Order("firebase_uid").Find(&holdings).Error; err != nil {
			return err
		}
		now := time.Now()
		for _, h := range holdings {
			w, err := r.LockWallet(tx, h.FirebaseUID)
			if err != nil {
				return err
			}
			amount := h.Shares * s.LastPrice
			if err := r.SetCash(tx, h.FirebaseUID, w.Cash+amount); err != nil {
				return err
			}
			trade := &av.JoyuTrade{FirebaseUID: h.FirebaseUID, StockID: id, Side: av.TradeSell, Shares: h.Shares, Amount: amount,
				PriceAfter: s.LastPrice, Counterparty: av.TradeCounterpartyDelist, CreatedAt: now}
			if err := r.InsertTrade(tx, trade); err != nil {
				return err
			}
		}
		if err := tx.Where("stock_id = ?", id).Delete(&av.JoyuHolding{}).Error; err != nil {
			return err
		}
		return tx.Model(&av.JoyuStock{}).Where("id = ?", id).
			Updates(map[string]any{"status": av.StockDelisted, "delisted_at": now, "shares_out": 0}).Error
	})
}

// DeleteByUID 刪帳號：持股從各檔的流通股數扣掉（價格照曲線重算，交給 reprice），再刪持股、成交、錢包
func (r *RepositoryJoyuMarket) DeleteByUID(uid string, reprice func(s av.JoyuStock, sharesOut int64) int64) error {
	return r.Transaction(func(tx *gorm.DB) error {
		var holdings []av.JoyuHolding
		if err := tx.Where("firebase_uid = ?", uid).Order("stock_id").Find(&holdings).Error; err != nil {
			return err
		}
		for _, h := range holdings {
			s, err := r.LockStock(tx, h.StockID)
			if err != nil {
				return err
			}
			out := max(s.SharesOut-h.Shares, 0)
			if err := r.SetStockPrice(tx, s.ID, out, reprice(*s, out)); err != nil {
				return err
			}
		}
		for _, m := range []any{&av.JoyuHolding{}, &av.JoyuTrade{}, &av.JoyuWallet{}} {
			if err := tx.Where("firebase_uid = ?", uid).Delete(m).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

package av

import (
	"errors"
	"fmt"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"

	"gorm.io/gorm"
)

// joyu 女優股市的報價與下單（系統造市，價格曲線見 joyu_market_price.go）

// 交易失敗的原因；controller 依這些轉成各自的錯誤碼，前端照錯誤碼顯示訊息
var (
	ErrMarketInvalid      = errors.New("invalid trade")
	ErrMarketNotTradable  = errors.New("stock is not tradable")
	ErrMarketPriceChanged = errors.New("price changed since the quote")
	ErrMarketPriceLimit   = errors.New("over the daily price limit")
	ErrMarketCash         = errors.New("not enough cash")
	ErrMarketShares       = errors.New("not enough sellable shares")
	ErrMarketSoldOut      = errors.New("reached the share cap")
	ErrMarketRateLimited  = errors.New("too many trades")
)

const (
	marketTradeRateKey    = "joyu:market:trade:uid:%s"
	marketTradeRateLimit  = 20 // 每位每分鐘最多 20 筆
	marketTradeRateWindow = time.Minute
)

// marketToday 台灣時間的今天（T+1 與每日價格紀錄都用這個切日）
func marketToday() string {
	return time.Now().Format(time.DateOnly)
}

// quoteFor 依目前狀態算 q 股的報價；MaxShares 買是現金／漲跌停／發行上限、賣是可賣股數／漲跌停，取最小
func quoteFor(s avEntity.JoyuStock, cash int64, h avEntity.JoyuHolding, side string, q int64) avEntity.MarketQuote {
	lo, hi := marketLimits(s.PrevClose)
	out := avEntity.MarketQuote{Side: side, Shares: q}
	var amount, fee, total, after int64
	if side == avEntity.TradeBuy {
		byLimit := min(maxBuyByLimit(s.Fundamental, s.SharesOut, hi), max(s.ShareCap-s.SharesOut, 0))
		out.MaxShares = maxBuyByCash(s.Fundamental, s.SharesOut, cash, byLimit)
		if q > 0 {
			amount = buyAmount(s.Fundamental, s.SharesOut, q)
			fee = marketFee(amount)
			total, after = amount+fee, marketPrice(s.Fundamental, s.SharesOut+q)
		}
	} else {
		out.MaxShares = min(h.Sellable(marketToday()), maxSellByLimit(s.Fundamental, s.SharesOut, lo))
		if q > 0 && q <= s.SharesOut {
			amount = sellAmount(s.Fundamental, s.SharesOut, q)
			fee = marketFee(amount)
			total, after = amount-fee, marketPrice(s.Fundamental, s.SharesOut-q)
		}
	}
	out.Amount, out.Fee, out.Total, out.TotalCents, out.PriceAfter = centsToUnits(amount), centsToUnits(fee), centsToUnits(total), total, centsToUnits(after)
	return out
}

// MarketQuoteFor 報價（個股頁輸入股數時即時算；第一次報價時順便開戶）
func MarketQuoteFor(uid, code, side string, q int64) (*avEntity.MarketQuote, error) {
	if (side != avEntity.TradeBuy && side != avEntity.TradeSell) || q < 0 || q > marketMaxShares {
		return nil, ErrMarketInvalid
	}
	s, err := avRepo.NewJoyuStock().FindByID(avEntity.StockIDFromCode(code))
	if err != nil {
		return nil, err
	}
	w, err := openMarketWallet(uid)
	if err != nil {
		return nil, err
	}
	h, err := avRepo.NewJoyuMarket().Holding(uid, s.ID)
	if err != nil {
		return nil, err
	}
	out := quoteFor(*s, w.Cash, h, side, q)
	return &out, nil
}

// MarketTrade 下單：在 transaction 裡鎖住這檔、錢包、持股後重新報價，檢查完才成交。
// req.Limit 是報價時的合計，價格在報價後動了（買的要付更多、賣的拿更少）就拒單，前端重新報價
func MarketTrade(uid, code string, req avEntity.MarketTradeRequest) (*avEntity.MarketQuote, error) {
	if (req.Side != avEntity.TradeBuy && req.Side != avEntity.TradeSell) || req.Shares <= 0 || req.Shares > marketMaxShares {
		return nil, ErrMarketInvalid
	}
	if ok, err := client.AllowFixedWindow(client.GetRedis(enum.RedisDefault), fmt.Sprintf(marketTradeRateKey, uid), marketTradeRateLimit, marketTradeRateWindow); err == nil && !ok {
		return nil, ErrMarketRateLimited
	}
	if _, err := openMarketWallet(uid); err != nil {
		return nil, err
	}
	id := avEntity.StockIDFromCode(code)
	repo := avRepo.NewJoyuMarket()
	var result avEntity.MarketQuote
	err := repo.Transaction(func(tx *gorm.DB) error {
		s, err := repo.LockStock(tx, id)
		if err != nil {
			return err
		}
		if s.Status != avEntity.StockListed {
			return ErrMarketNotTradable
		}
		w, err := repo.LockWallet(tx, uid)
		if err != nil {
			return err
		}
		h, err := repo.LockHolding(tx, uid, s.ID)
		if err != nil {
			return err
		}
		result = quoteFor(*s, w.Cash, h, req.Side, req.Shares)
		if err := checkTrade(*s, w.Cash, h, req, result); err != nil {
			return err
		}
		return applyTrade(tx, repo, *s, w.Cash, h, req)
	})
	if err != nil {
		return nil, err
	}
	// 回傳這筆實際成交的金額（成交前那一刻的報價）；最多可買／可賣已經變了，前端會重新報價
	result.MaxShares = 0
	return &result, nil
}

// checkTrade 成交前的檢查：股數上限（現金／可賣／漲跌停）與報價後價格有沒有變
func checkTrade(s avEntity.JoyuStock, cash int64, h avEntity.JoyuHolding, req avEntity.MarketTradeRequest, q avEntity.MarketQuote) error {
	if req.Shares > q.MaxShares {
		switch {
		case req.Side == avEntity.TradeSell && req.Shares > h.Sellable(marketToday()):
			return ErrMarketShares
		case req.Side == avEntity.TradeBuy && s.SharesOut+req.Shares > s.ShareCap:
			return ErrMarketSoldOut
		case req.Side == avEntity.TradeBuy && q.TotalCents > cash:
			return ErrMarketCash
		default:
			return ErrMarketPriceLimit
		}
	}
	if (req.Side == avEntity.TradeBuy && q.TotalCents > req.Limit) || (req.Side == avEntity.TradeSell && q.TotalCents < req.Limit) {
		return ErrMarketPriceChanged
	}
	return nil
}

// applyTrade 寫入成交：流通股數與現價、現金、持股（成本依比例扣、今天買的另外記）、成交紀錄、當天開高低收
func applyTrade(tx *gorm.DB, repo *avRepo.RepositoryJoyuMarket, s avEntity.JoyuStock, cash int64, h avEntity.JoyuHolding, req avEntity.MarketTradeRequest) error {
	today := marketToday()
	now := time.Now()
	sharesOut, fee, amount := s.SharesOut+req.Shares, int64(0), int64(0)
	if req.Side == avEntity.TradeBuy {
		amount = buyAmount(s.Fundamental, s.SharesOut, req.Shares)
		fee = marketFee(amount)
		cash -= amount + fee
		if h.TodayDate == nil || h.TodayDate.Format(time.DateOnly) != today {
			h.TodayBought, h.TodayDate = 0, &now
		}
		h.Shares, h.Cost, h.TodayBought = h.Shares+req.Shares, h.Cost+amount+fee, h.TodayBought+req.Shares
	} else {
		sharesOut = s.SharesOut - req.Shares
		amount = sellAmount(s.Fundamental, s.SharesOut, req.Shares)
		fee = marketFee(amount)
		cash += amount - fee
		h.Cost -= h.Cost * req.Shares / h.Shares
		h.Shares -= req.Shares
	}
	h.UpdatedAt = now
	price := marketPrice(s.Fundamental, sharesOut)
	if err := repo.SetStockPrice(tx, s.ID, sharesOut, price); err != nil {
		return err
	}
	if err := repo.SetCash(tx, h.FirebaseUID, cash); err != nil {
		return err
	}
	if err := repo.SaveHolding(tx, h); err != nil {
		return err
	}
	trade := &avEntity.JoyuTrade{FirebaseUID: h.FirebaseUID, StockID: s.ID, Side: req.Side, Shares: req.Shares, Amount: amount,
		Fee: fee, PriceAfter: price, Counterparty: avEntity.TradeCounterpartySystem, CreatedAt: now}
	if err := repo.InsertTrade(tx, trade); err != nil {
		return err
	}
	return repo.AddDaily(tx, s.ID, today, s.LastPrice, price, req.Shares)
}

// openMarketWallet 開戶（第一次進股市的報價、錢包頁、下單都會呼叫）：沒有錢包才建，入帳 100000 單位
func openMarketWallet(uid string) (*avEntity.JoyuWallet, error) {
	repo := avRepo.NewJoyuMarket()
	if err := repo.EnsureWallet(uid, marketInitialCash); err != nil {
		return nil, err
	}
	return repo.Wallet(uid)
}

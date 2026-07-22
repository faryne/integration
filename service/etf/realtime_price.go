package etf

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"faryne.dev/model/enum"
	etfRepo "faryne.dev/repository/etf"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/twse"
	"github.com/go-redis/redis/v7"
	"go.uber.org/zap"
	"golang.org/x/sync/singleflight"
)

// realtimePriceCacheTTL 決定「即時價格」的更新頻率上限：同一支代碼在這段時間內
// 不管被查詢幾次，都只會打一次證交所 API；收盤後快取自然過期就不會再有新資料，
// 前端會 fallback 顯示最新收盤價。
const realtimePriceCacheTTL = 10 * time.Second

var realtimePriceGroup singleflight.Group

// RealtimePriceItem 是「我的最愛」即時報價 API 的單一代碼結果。LivePrice 是 nil
// 代表現在沒有即時價（非開盤時間、快取還沒中、或這檔還沒成交過），前端應該
// fallback 顯示 LatestClose。
type RealtimePriceItem struct {
	Code        string   `json:"code"`
	LatestClose float64  `json:"latest_close"`
	LivePrice   *float64 `json:"live_price"`
}

func realtimePriceCacheKey(code string) string {
	return fmt.Sprintf("etf:realtime_price:%s", code)
}

// isMarketOpenNow 只判斷平日 09:00-13:30（台北時間），不考慮國定假日/臨時休市；
// 假日誤判成開盤頂多多打一次證交所 API 拿到空資料，不影響正確性。
func isMarketOpenNow() bool {
	loc, err := time.LoadLocation("Asia/Taipei")
	if err != nil {
		return false
	}
	now := time.Now().In(loc)
	if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday {
		return false
	}
	open := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, loc)
	closeTime := time.Date(now.Year(), now.Month(), now.Day(), 13, 30, 0, 0, loc)
	return !now.Before(open) && !now.After(closeTime)
}

// GetFavoritesRealtimePrices 回傳使用者所有收藏 ETF 的即時價格（有快取才有值）跟
// 最新收盤價（永遠有值，作為 fallback）。即時價格用「代碼」當快取 key，不同使用者
// 收藏重疊的代碼會共用同一份快取；快取沒中且現在是開盤時間才會真的打證交所 API，
// 同一時間多個請求缺同一批快取時會用 singleflight 合併成一次上游請求。
func GetFavoritesRealtimePrices(userID uint64) ([]RealtimePriceItem, error) {
	favorites, err := ListFavorites(userID)
	if err != nil {
		return nil, err
	}
	if len(favorites) == 0 {
		return []RealtimePriceItem{}, nil
	}

	codes := make([]string, len(favorites))
	for i, f := range favorites {
		codes[i] = f.Code
	}

	etfs, err := etfRepo.NewETFCode().GetByCodes(codes)
	if err != nil {
		return nil, err
	}
	marketByCode := make(map[string]enum.StockMarket, len(etfs))
	closeByCode := make(map[string]float64, len(etfs))
	for _, e := range etfs {
		marketByCode[e.Code] = e.Market
		closeByCode[e.Code] = e.LatestClose
	}

	livePrices := getLivePricesCached(codes, marketByCode)

	out := make([]RealtimePriceItem, len(codes))
	for i, code := range codes {
		item := RealtimePriceItem{Code: code, LatestClose: closeByCode[code]}
		if price, ok := livePrices[code]; ok {
			p := price
			item.LivePrice = &p
		}
		out[i] = item
	}
	return out, nil
}

func getLivePricesCached(codes []string, marketByCode map[string]enum.StockMarket) map[string]float64 {
	result := make(map[string]float64, len(codes))

	redisClient := client.GetRedis(enum.RedisDefault)
	missing := codes

	if redisClient != nil {
		keys := make([]string, len(codes))
		for i, code := range codes {
			keys[i] = realtimePriceCacheKey(code)
		}
		cached, err := redisClient.MGet(keys...).Result()
		if err == nil {
			missing = make([]string, 0, len(codes))
			for i, raw := range cached {
				s, ok := raw.(string)
				if !ok {
					missing = append(missing, codes[i])
					continue
				}
				price, parseErr := strconv.ParseFloat(s, 64)
				if parseErr != nil {
					missing = append(missing, codes[i])
					continue
				}
				result[codes[i]] = price
			}
		}
	}

	if len(missing) == 0 || !isMarketOpenNow() {
		return result
	}

	for code, price := range fetchAndCacheLivePrices(missing, marketByCode, redisClient) {
		result[code] = price
	}
	return result
}

// fetchAndCacheLivePrices 用「這批缺快取的代碼」組成 singleflight key：同一時間如果
// 有多個請求剛好缺同一批代碼（最常見的情況是同一批快取剛好一起過期），會合併成
// 一次上游請求；代碼組合不同的請求不會互相 dedupe，但每個請求本身仍然只會打一次
// 批次查詢，不會變成一支代碼一次上游請求。
func fetchAndCacheLivePrices(
	codes []string,
	marketByCode map[string]enum.StockMarket,
	redisClient *redis.Client,
) map[string]float64 {
	sorted := append([]string(nil), codes...)
	sort.Strings(sorted)
	groupKey := strings.Join(sorted, ",")

	result, err, _ := realtimePriceGroup.Do(groupKey, func() (any, error) {
		requestCodes := make([]twse.RealtimePriceCode, 0, len(codes))
		for _, code := range codes {
			market, ok := marketByCode[code]
			if !ok {
				continue
			}
			requestCodes = append(requestCodes, twse.RealtimePriceCode{Code: code, Market: market})
		}
		if len(requestCodes) == 0 {
			return map[string]float64{}, nil
		}

		prices := twse.FetchRealtimePrices(requestCodes)

		if redisClient != nil {
			pipe := redisClient.Pipeline()
			for code, price := range prices {
				pipe.Set(realtimePriceCacheKey(code), strconv.FormatFloat(price, 'f', -1, 64), realtimePriceCacheTTL)
			}
			if _, pipeErr := pipe.Exec(); pipeErr != nil {
				log.Logger().Warn("Cache ETF realtime prices failed", zap.Error(pipeErr))
			}
		}

		return prices, nil
	})
	if err != nil {
		return map[string]float64{}
	}
	return result.(map[string]float64)
}

package etf

import (
	"encoding/json"
	"fmt"
	"time"

	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	etfRepo "faryne.dev/repository/etf"
	"faryne.dev/service/client"
)

// 配息紀錄一天只跑一次排程，快取久一點也不會拿到過期資料，同時大幅降低使用者
// 收藏一多（例如 150+ 支）時「我的最愛」總覽頁把 DB 打爆的風險。
const favoriteBatchShareCacheTTL = 12 * time.Hour

type FavoriteBatchItem struct {
	Code          string                 `json:"code"`
	Distributions []etf.Share            `json:"distributions"`
	Transactions  etf.ProfitTransactions `json:"transactions"`
}

func shareCacheKey(code string) string {
	return fmt.Sprintf("etf:share_history:%s", code)
}

// getSharesByCodesCached 用 Redis pipeline 一次查詢所有代號的配息紀錄快取，沒中的
// 代號再合併成一次 SQL 查回來、寫回快取。用「代號」當快取 key（而不是整批代號組成
// 的 hash）才能讓不同使用者、不同收藏組合之間互相共用快取，熱門 ETF 幾乎都能命中。
func getSharesByCodesCached(codes []string) (map[string][]etf.Share, error) {
	result := make(map[string][]etf.Share, len(codes))
	if len(codes) == 0 {
		return result, nil
	}

	redisClient := client.GetRedis(enum.RedisDefault)
	missing := codes

	if redisClient != nil {
		keys := make([]string, len(codes))
		for i, code := range codes {
			keys[i] = shareCacheKey(code)
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
				var rows []etf.Share
				if json.Unmarshal([]byte(s), &rows) != nil {
					missing = append(missing, codes[i])
					continue
				}
				result[codes[i]] = rows
			}
		}
	}

	if len(missing) == 0 {
		return result, nil
	}

	rows, err := etfRepo.NewETFShare().GetETFShareByCodes(missing)
	if err != nil {
		return nil, err
	}
	byCode := make(map[string][]etf.Share, len(missing))
	for _, row := range rows {
		byCode[row.Code] = append(byCode[row.Code], row)
	}
	for _, code := range missing {
		result[code] = byCode[code] // 沒有配息紀錄的代號會是 nil，一樣要寫入快取，避免每次都重查
	}

	if redisClient != nil {
		pipe := redisClient.Pipeline()
		for _, code := range missing {
			raw, marshalErr := json.Marshal(result[code])
			if marshalErr != nil {
				continue
			}
			pipe.Set(shareCacheKey(code), string(raw), favoriteBatchShareCacheTTL)
		}
		_, _ = pipe.Exec() // 快取寫入失敗不影響本次回應，下次請求會重查
	}

	return result, nil
}

// ListFavoritesBatch 一次回傳使用者所有收藏 ETF 的配息紀錄跟已儲存交易紀錄，取代
// 前端原本「N 支收藏各打配息紀錄 + 交易紀錄兩支 API」的做法（N 大時等於一次觸發
// 2N 個並行請求）。配息紀錄是公開資料，經過 Redis 快取；交易紀錄是使用者私有資料，
// 用 IN 查詢合併成一次 SQL，不快取。
func ListFavoritesBatch(userID uint64) ([]FavoriteBatchItem, error) {
	favorites, err := ListFavorites(userID)
	if err != nil {
		return nil, err
	}
	if len(favorites) == 0 {
		return []FavoriteBatchItem{}, nil
	}

	codes := make([]string, len(favorites))
	for i, f := range favorites {
		codes[i] = f.Code
	}

	sharesByCode, err := getSharesByCodesCached(codes)
	if err != nil {
		return nil, err
	}

	txRows, err := etfRepo.NewETFSavedTransaction().FindByUserAndCodes(userID, codes)
	if err != nil && !repository.IsRecordNotFound(err) {
		return nil, err
	}
	txByCode := make(map[string]etf.ProfitTransactions, len(txRows))
	for _, row := range txRows {
		if row.DeletedAt != nil {
			continue
		}
		txByCode[row.Code] = normalizeSells(row.Records)
	}

	out := make([]FavoriteBatchItem, len(codes))
	for i, code := range codes {
		transactions := txByCode[code]
		if transactions == nil {
			transactions = etf.ProfitTransactions{}
		}
		out[i] = FavoriteBatchItem{
			Code:          code,
			Distributions: sharesByCode[code],
			Transactions:  transactions,
		}
	}
	return out, nil
}

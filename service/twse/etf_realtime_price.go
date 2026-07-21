package twse

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"faryne.dev/model/enum"
)

// RealtimePriceUrl 是證交所盤中即時報價 API，非正式文件化的公開端點（給官網自己前端用），
// 行為可能隨時變動，不保證長期穩定。
const RealtimePriceUrl = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp"

// realtimePriceBatchSize：實測這支 API 一次最多可以帶約 140 檔（超過會回 rtcode
// 9999 或直接 414 URI 太長），這裡抓保守一點的安全邊界。
const realtimePriceBatchSize = 100

type RealtimePriceCode struct {
	Code   string
	Market enum.StockMarket
}

type realtimePriceItem struct {
	Price string `json:"z"` // 最新成交價，字串；還沒開盤/沒成交過時是 "-"
}

type realtimePriceResponse struct {
	MsgArray []realtimePriceItem `json:"msgArray"`
	Rtcode   string              `json:"rtcode"`
}

func realtimeExCh(code RealtimePriceCode) string {
	prefix := "twse"
	if code.Market == enum.StockMarketOTC {
		prefix = "otc"
	}
	return fmt.Sprintf("%s_%s.tw", prefix, code.Code)
}

// FetchRealtimePrices 批次查詢多檔 ETF 的盤中即時成交價，超過 realtimePriceBatchSize
// 會自動切成多次請求。回傳的 map 只包含「真的有成交價」的代碼；還沒開盤、還沒成交、
// 或查無資料的代碼都不會出現在結果裡，呼叫端要自行 fallback 到最新收盤價。
// 單一批次請求失敗時只跳過那一批，不中斷其他批次——反正下次輪詢會再試一次。
func FetchRealtimePrices(codes []RealtimePriceCode) map[string]float64 {
	result := make(map[string]float64, len(codes))

	for start := 0; start < len(codes); start += realtimePriceBatchSize {
		end := start + realtimePriceBatchSize
		if end > len(codes) {
			end = len(codes)
		}
		batch := codes[start:end]

		exChList := make([]string, len(batch))
		for i, code := range batch {
			exChList[i] = realtimeExCh(code)
		}

		params := url.Values{}
		params.Add("ex_ch", strings.Join(exChList, "|"))
		params.Add("json", "1")
		params.Add("delay", "0")
		params.Add("lang", "zh_tw")

		resp, err := sendRequest[realtimePriceResponse](http.MethodGet, RealtimePriceUrl, params, nil)
		if err != nil {
			continue
		}

		// 用位置對應回原本請求的代碼，不能用回傳內容本身的欄位比對——沒有成交價
		// 時該筆資料的股票代碼欄位也會是空字串，無法拿來反查是哪一檔。
		for i, item := range resp.MsgArray {
			if i >= len(batch) {
				break
			}
			price, parseErr := strconv.ParseFloat(item.Price, 64)
			if parseErr != nil {
				continue
			}
			result[batch[i].Code] = price
		}
	}

	return result
}

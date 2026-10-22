package rates

import (
	"math"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
	"faryne.dev/service/log"
)

// 各家牌告都是台灣時間；用固定時區，避免執行環境沒有 tzdata
var taipei = time.FixedZone("Asia/Taipei", 8*60*60)

// today 來源沒附報價時間時，以台灣當天作為 record_date
func today() time.Time {
	return time.Now().In(taipei)
}

// recordBuilder 收集一家銀行的匯率；不合法的單筆直接略過，最後由 records 取出
type recordBuilder struct {
	date    string
	records []ratesEntity.RateRecord
}

func newRecordBuilder(date time.Time) *recordBuilder {
	return &recordBuilder{date: date.In(taipei).Format(time.DateOnly)}
}

// add 加入一筆匯率。買賣價為 0、空字串、"-"（該行不提供此幣別現鈔）時略過；
// 買價 ≥ 賣價屬來源異常，略過並 warn。欄位是 decimal(8,5)，先 round 到 5 位。
func (b *recordBuilder) add(base, buy, sell string) {
	base = strings.ToUpper(strings.TrimSpace(base))
	buyRate, sellRate := parseRate(buy), parseRate(sell)
	if base == "" || buyRate <= 0 || sellRate <= 0 {
		return
	}
	if buyRate >= sellRate {
		log.Logger().Warn("Rates buy >= sell, skipped", zap.String("base", base), zap.Float64("buy", buyRate), zap.Float64("sell", sellRate))
		return
	}
	b.records = append(b.records, ratesEntity.RateRecord{
		Base:       base,
		BuyRate:    buyRate,
		SellRate:   sellRate,
		RecordDate: b.date,
	})
}

// parseRate 解析不了的一律當 0，交給 add 略過
func parseRate(s string) float64 {
	v, err := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(s), ",", ""), 64)
	if err != nil {
		return 0
	}
	return math.Round(v*1e5) / 1e5
}

// parseDate 依 layout 解析來源的報價時間，失敗就退回今天
func parseDate(layout, value string) time.Time {
	if t, err := time.ParseInLocation(layout, strings.TrimSpace(value), taipei); err == nil {
		return t
	}
	return today()
}

package rates

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"

	"go.uber.org/zap"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
	ratesRepository "faryne.dev/repository/rates"
	"faryne.dev/service/log"
)

// Bank 一家銀行的匯率來源：Fetch 只負責抓當下牌告的現鈔匯率，service_name / to 由 runBank 統一補上。
// Fetch 為 nil 代表已停用，只保留名稱讓歷史資料能查
type Bank struct {
	Name  string // 前台顯示名稱
	Fetch func(ctx context.Context) ([]ratesEntity.RateRecord, error)
}

// Banks 以 service_name 為 key（沿用 PHP 時代的值，歷史資料才接得上）；新增銀行時在這裡加一行
var Banks = map[string]Bank{
	// 台銀整個網域都在 JS challenge 後面，連 headless Chrome 都不放行（2026-10-22 實測），
	// 不做偽裝 fingerprint 繞過，先停用；詳見 DevelopDocuments/opendata/匯率爬蟲移植_2026-10-22.md
	"BOT":     {Name: "台灣銀行"},
	"land":    {Name: "土地銀行", Fetch: fetchLand},
	"Mega":    {Name: "兆豐銀行", Fetch: fetchMega},
	"esun":    {Name: "玉山銀行", Fetch: fetchEsun},
	"cathay":  {Name: "國泰世華銀行", Fetch: fetchCathay},
	"sinopac": {Name: "永豐銀行", Fetch: fetchSinopac},
	"first":   {Name: "第一銀行", Fetch: fetchFirst},
}

// BankNames 給 API 列出支援的銀行：service_name → 中文名
func BankNames() map[string]string {
	out := make(map[string]string, len(Banks))
	for k, b := range Banks {
		out[k] = b.Name
	}
	return out
}

// Run 抓取並寫入指定銀行的匯率，bank 為空字串時跑全部；單家失敗只記 log，不影響其他家
func Run(ctx context.Context, bank string) error {
	names := slices.Sorted(maps.Keys(Banks))
	if bank != "" {
		b, ok := Banks[bank]
		switch {
		case !ok:
			return fmt.Errorf("unknown bank %q", bank)
		case b.Fetch == nil:
			return fmt.Errorf("bank %q is disabled", bank)
		}
		names = []string{bank}
	}

	var errs []error
	for _, name := range names {
		if Banks[name].Fetch == nil {
			continue
		}
		count, err := runBank(ctx, name)
		if err != nil {
			log.Logger().Error("Rates fetch failed", zap.String("bank", name), zap.Error(err))
			errs = append(errs, fmt.Errorf("%s: %w", name, err))
			continue
		}
		log.Logger().Info("Rates fetched", zap.String("bank", name), zap.Int("rows", count))
	}
	return errors.Join(errs...)
}

func runBank(ctx context.Context, name string) (int, error) {
	records, err := Banks[name].Fetch(ctx)
	if err != nil {
		return 0, err
	}
	// 一筆都沒有通常代表官網改版、selector 失效，當成錯誤讓 log 看得到
	if len(records) == 0 {
		return 0, errors.New("parsed 0 rows")
	}
	for i := range records {
		records[i].ServiceName = name
		records[i].To = "TWD"
	}
	return len(records), ratesRepository.UpsertRates(records)
}

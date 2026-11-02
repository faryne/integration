package twse

import (
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"faryne.dev/model/entity/opendata/etf"
	etfRepo "faryne.dev/repository/etf"
	"faryne.dev/service/helper"
	"github.com/shopspring/decimal"
)

const (
	ETFSplitHistoryUrl = "https://www.twse.com.tw/rwd/zh/split/TWTCAU" // ETF 分割(反分割)恢復買賣參考價格（已恢復買賣）
	ETFSplitPreviewUrl = "https://www.twse.com.tw/rwd/zh/split/TWTC9U" // ETF 分割(反分割)預告表（尚未恢復買賣）
	// 沒指定區間時往回抓的天數：排程每天跑，預告表通常提前一週以上就會出現，60 天綽綽有餘
	etfSplitDefaultLookbackDays = 60
	// 反推比率允許的相對誤差：參考價四捨五入到 0.01，實際誤差遠小於 1%，超過就當成非整數倍
	etfSplitRatioTolerance = 0.01
)

// UpdateETFSplitEvents 抓證交所 ETF 分割/反分割紀錄寫進 etf_split_events。
// dayFrom/dayTo（YYYY-MM-DD）是歷史表的查詢區間，空值時預設抓最近 60 天到今天，
// 回補舊資料可用 -cmd etf-split-twse -dayFrom 2024-01-01。
func UpdateETFSplitEvents(dayFrom, dayTo string) {
	now := time.Now()
	today := now.Format(time.DateOnly)
	if dayFrom == "" {
		dayFrom = now.AddDate(0, 0, -etfSplitDefaultLookbackDays).Format(time.DateOnly)
	}
	if dayTo == "" {
		dayTo = today
	}
	repo := etfRepo.NewETFSplit()

	// 預告表：比率精確，覆蓋既有紀錄；撈不到就不做撤銷比對，避免 API 掛掉時把預告全刪光
	previews, err := getTWSEETFSplitPreviews()
	if err != nil {
		fmt.Println("etf split preview error:", err)
	} else {
		if err := repo.UpsertPreviews(previews); err != nil {
			fmt.Println("etf split preview upsert error:", err)
		}
		removeCancelledSplitPreviews(repo, previews, today)
	}

	// 歷史表：比率反推，只補 DB 還沒有的事件
	histories, err := getTWSEETFSplitHistories(dayFrom, dayTo)
	if err != nil {
		fmt.Println("etf split history error:", err)
		return
	}
	if err := repo.InsertHistoriesIfAbsent(histories); err != nil {
		fmt.Println("etf split history insert error:", err)
	}
}

// removeCancelledSplitPreviews 恢復買賣日還沒到、但已不在最新預告表上的事件視為撤銷或延期，
// 刪掉以免錯誤的分割倍數被套進損益試算；已生效的紀錄不動。
func removeCancelledSplitPreviews(repo *etfRepo.RepositoryETFSplit, latest []etf.SplitEvent, today string) {
	existing, err := repo.GetFuturePreviews(today)
	if err != nil {
		fmt.Println("etf split future preview query error:", err)
		return
	}
	keep := make(map[string]struct{}, len(latest))
	for _, row := range latest {
		keep[row.Code+"|"+row.EffectiveDate] = struct{}{}
	}
	ids := make([]int64, 0)
	for _, row := range existing {
		if _, ok := keep[row.Code+"|"+row.EffectiveDate]; !ok {
			fmt.Printf("etf split preview cancelled, code: %s, date: %s\n", row.Code, row.EffectiveDate)
			ids = append(ids, row.Id)
		}
	}
	if err := repo.DeleteByIds(ids); err != nil {
		fmt.Println("etf split preview delete error:", err)
	}
}

// getTWSEETFSplitPreviews 預告表欄位：停止買賣日期, ETF代號, 名稱, 分割(反分割), 恢復買賣日期, 分割(反分割)比率, ...
func getTWSEETFSplitPreviews() ([]etf.SplitEvent, error) {
	r, err := sendRequest[ResponseData](http.MethodGet, ETFSplitPreviewUrl, nil, nil)
	if err != nil {
		return nil, err
	}
	out := make([]etf.SplitEvent, 0, len(r.Data))
	for _, row := range r.Data {
		code, codeOK := twseRowString(row, 1)
		date, dateErr := twseRowROCDate(row, 4)
		ratio, ratioErr := twseRowDecimal(row, 5)
		if !codeOK || dateErr != nil || ratioErr != nil || ratio <= 0 {
			fmt.Printf("invalid etf split preview row: %+v\n", row)
			continue
		}
		out = append(out, etf.SplitEvent{Code: strings.TrimSpace(code), EffectiveDate: date, Ratio: ratio, Source: etf.SplitEventSourcePreview})
	}
	return out, nil
}

// getTWSEETFSplitHistories 歷史表欄位：恢復買賣日期, ETF代號, 名稱, 分割(反分割), 停止買賣前收盤價格, 恢復買賣參考價, ...
// 證交所沒給比率，用「參考價 = 停止買賣前收盤價 / 比率」反推。
func getTWSEETFSplitHistories(dayFrom, dayTo string) ([]etf.SplitEvent, error) {
	params := url.Values{}
	params.Add("startDate", strings.ReplaceAll(dayFrom, "-", ""))
	params.Add("endDate", strings.ReplaceAll(dayTo, "-", ""))
	r, err := sendRequest[ResponseData](http.MethodGet, ETFSplitHistoryUrl, params, nil)
	if err != nil {
		return nil, err
	}
	out := make([]etf.SplitEvent, 0, len(r.Data))
	for _, row := range r.Data {
		code, codeOK := twseRowString(row, 1)
		date, dateErr := twseRowROCDate(row, 0)
		closePrice, closeErr := twseRowDecimal(row, 4)
		refPrice, refErr := twseRowDecimal(row, 5)
		if !codeOK || dateErr != nil || closeErr != nil || refErr != nil {
			fmt.Printf("invalid etf split history row: %+v\n", row)
			continue
		}
		ratio, ok := deriveSplitRatio(closePrice, refPrice)
		if !ok {
			// 非整數倍（例如 1 拆 2.5）反推不出可信的比率，寧可漏寫也不要寫錯讓損益整個算歪
			fmt.Printf("skip etf split history with non-integer ratio, code: %s, date: %s, close: %v, ref: %v\n", code, date, closePrice, refPrice)
			continue
		}
		out = append(out, etf.SplitEvent{Code: strings.TrimSpace(code), EffectiveDate: date, Ratio: ratio, Source: etf.SplitEventSourceHistory})
	}
	return out, nil
}

// deriveSplitRatio 由停止買賣前收盤價與恢復買賣參考價反推比率：分割取「收盤 / 參考」、
// 反分割取「參考 / 收盤」的倒數，兩者都必須接近整數（1 拆 11、7 合 1 這種都沒問題）。
func deriveSplitRatio(closePrice, refPrice float64) (float64, bool) {
	if closePrice <= 0 || refPrice <= 0 || closePrice == refPrice {
		return 0, false
	}
	isSplit := closePrice > refPrice
	raw := refPrice / closePrice
	if isSplit {
		raw = closePrice / refPrice
	}
	n := math.Round(raw)
	if n < 2 || math.Abs(raw-n)/n > etfSplitRatioTolerance {
		return 0, false
	}
	if isSplit {
		return n, true
	}
	return 1 / n, true
}

// twseRowROCDate 民國日期（114/06/18）轉 YYYY-MM-DD
func twseRowROCDate(row []any, index int) (string, error) {
	text, ok := twseRowString(row, index)
	if !ok {
		return "", fmt.Errorf("missing date at %d", index)
	}
	return helper.ROCFullDateToAD(text, time.DateOnly)
}

// twseRowDecimal 數字欄位（可能帶千分位逗號，例如 9,999.95）
func twseRowDecimal(row []any, index int) (float64, error) {
	text, ok := twseRowString(row, index)
	if !ok {
		return 0, fmt.Errorf("missing number at %d", index)
	}
	d, err := decimal.NewFromString(strings.ReplaceAll(text, ",", ""))
	if err != nil {
		return 0, err
	}
	return d.InexactFloat64(), nil
}

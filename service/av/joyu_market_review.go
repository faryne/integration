package av

import (
	"context"
	"fmt"
	"sort"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// marketIPOPrice IPO 價 10 單位（分）
const marketIPOPrice = 1000

// marketDelistMaxRatio 一次下市超過這個比例就不下市、只記錯誤：多半是 ES 出狀況、部數全變 0，不能整個市場一起下市
const marketDelistMaxRatio = 0.2

// RunMarketReviewCron 每月審核：符合資格又還沒上市過的上市（IPO 10 單位），已上市的更新名字快照與近 90 天部數；
// 近 12 個月沒出片（不含總集編）或女優資料不見了的下市，持股照現價買回。下市過的不會再上市。
// dryRun 只印出門檻對照表與名單、不寫入（校準門檻用）
func RunMarketReviewCron(dryRun bool) {
	ctx := context.Background()
	cands, err := marketCandidates(ctx, time.Now())
	if err != nil {
		log.Logger().Error("market review failed: " + err.Error())
		return
	}
	if dryRun {
		printMarketCalibration(cands)
		return
	}
	listed, updated, err := applyMarketReview(cands, time.Now())
	if err != nil {
		log.Logger().Error("market review apply failed: " + err.Error())
		return
	}
	delisted, err := applyMarketDelist(cands)
	if err != nil {
		log.Logger().Error("market delist failed: " + err.Error())
	}
	log.Logger().Info("market review finished", zap.Int("listed", listed), zap.Int("updated", updated), zap.Int("delisted", delisted))
}

// applyMarketDelist 下市審核：上市中但近 12 個月沒出片、或已經不在候選名單（近三年都沒片、女優資料被刪）的
func applyMarketDelist(cands []marketCandidate) (int, error) {
	stocks, err := avRepo.NewJoyuStock().ListListedPrimary()
	if err != nil {
		return 0, err
	}
	recentYear := make(map[avRepo.ActressKey]int, len(cands))
	for _, c := range cands {
		recentYear[avRepo.ActressKey{Domain: c.Row.Domain, ID: c.Row.ID}] = c.Years[0]
	}
	var out []avEntity.JoyuStock
	for _, s := range stocks {
		if recentYear[avRepo.ActressKey{Domain: s.Domain, ID: s.AID}] == 0 {
			out = append(out, s)
		}
	}
	if len(out) > int(float64(len(stocks))*marketDelistMaxRatio) {
		return 0, fmt.Errorf("refuse to delist %d of %d stocks at once", len(out), len(stocks))
	}
	repo := avRepo.NewJoyuMarket()
	for _, s := range out {
		if err := repo.DelistStock(s.ID); err != nil {
			return 0, fmt.Errorf("delist %d: %w", s.ID, err)
		}
	}
	return len(out), nil
}

// applyMarketReview 寫入審核結果；回傳新上市與更新的檔數
func applyMarketReview(cands []marketCandidate, now time.Time) (int, int, error) {
	repo := avRepo.NewJoyuStock()
	existing, err := repo.ListAllForReview()
	if err != nil {
		return 0, 0, err
	}
	byKey := make(map[avRepo.ActressKey]avEntity.JoyuStock, len(existing))
	for _, s := range existing {
		byKey[avRepo.ActressKey{Domain: s.Domain, ID: s.AID}] = s
	}

	var fresh []marketCandidate
	updated := 0
	for _, c := range cands {
		s, ok := byKey[avRepo.ActressKey{Domain: c.Row.Domain, ID: c.Row.ID}]
		switch {
		case !ok && marketEligible(c.Years, marketListMinPerYear, marketListMinTotal):
			fresh = append(fresh, c)
		case ok && s.Status == avEntity.StockListed && (s.Name != c.Row.Name || s.Videos90d != c.Recent):
			if err := repo.UpdateReview(s.ID, c.Row.Name, c.Recent); err != nil {
				return 0, updated, err
			}
			updated++
		}
	}
	// 新上市依近三年部數由多到少排，代碼小的就是當下最活躍的
	sort.SliceStable(fresh, func(i, j int) bool { return fresh[i].Total > fresh[j].Total })
	rows := make([]avEntity.JoyuStock, len(fresh))
	for i, c := range fresh {
		rows[i] = avEntity.JoyuStock{
			Domain: c.Row.Domain, AID: c.Row.ID, Name: c.Row.Name, Status: avEntity.StockListed,
			Fundamental: 10, OpenFundamental: 10, ShareCap: marketDefaultShareCap, LastPrice: marketIPOPrice, PrevClose: marketIPOPrice, Videos90d: c.Recent, ListedAt: now,
		}
	}
	return len(rows), updated, repo.CreateBatch(rows)
}

// printMarketCalibration dry-run 輸出：門檻對照表＋目前門檻下部數最多的前 30 位與剛好過門檻的 10 位
func printMarketCalibration(cands []marketCandidate) {
	perYear := []int{1, 2, 4, 6, 8, 12}
	totals := []int{12, 24, 30, 50, 80, 120}
	fmt.Printf("有出片的女優（近 %d 年）：%d 位\n\n每年至少＼合計至少", marketListYears, len(cands))
	for _, t := range totals {
		fmt.Printf("\t%d", t)
	}
	fmt.Println()
	for _, p := range perYear {
		fmt.Printf("%d", p)
		for _, t := range totals {
			n := 0
			for _, c := range cands {
				if marketEligible(c.Years, p, t) {
					n++
				}
			}
			fmt.Printf("\t%d", n)
		}
		fmt.Println()
	}

	var listed []marketCandidate
	for _, c := range cands {
		if marketEligible(c.Years, marketListMinPerYear, marketListMinTotal) {
			listed = append(listed, c)
		}
	}
	sort.Slice(listed, func(i, j int) bool { return listed[i].Total > listed[j].Total })
	fmt.Printf("\n目前門檻（每年 ≥ %d、合計 ≥ %d）：%d 位上市\n", marketListMinPerYear, marketListMinTotal, len(listed))
	show := func(c marketCandidate) {
		fmt.Printf("  %s（%s-%d）近一年 %d／前一年 %d／再前一年 %d，合計 %d，近 90 天 %d\n", c.Row.Name, c.Row.Domain, c.Row.ID, c.Years[0], c.Years[1], c.Years[2], c.Total, c.Recent)
	}
	for _, c := range listed[:min(30, len(listed))] {
		show(c)
	}
	if len(listed) > 40 {
		fmt.Println("  …剛好過門檻的：")
		for _, c := range listed[len(listed)-10:] {
			show(c)
		}
	}
}

package av

import (
	"context"
	"fmt"
	"sort"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
)

// joyu 女優股市的上市資格（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）：
// 最近 marketListYears 個滾動 12 個月，每一段都至少 marketListMinPerYear 部，合計至少 marketListMinTotal 部。
// 片數只算已配信、排除總集編（一位當紅女優一年上百部總集編，算進去上市門檻和股價都會失真），名字去掉括號別名後合併，
// 同名女優用對照表逐位分（P0 已知差異：同名的逐位查還沒排除總集編，P1 補上）
const (
	marketListYears      = 3
	marketListMinPerYear = 4
	marketListMinTotal   = 30
)

// marketCandidate 一位女優在各滾動年度的配信部數；Years[0] 是最近 12 個月
type marketCandidate struct {
	Row   avEntity.DMMActress
	Years []int
	Total int
}

// marketEligible 每一段都達標、合計也達標才上市
func marketEligible(years []int, minPerYear, minTotal int) bool {
	total := 0
	for _, n := range years {
		if n < minPerYear {
			return false
		}
		total += n
	}
	return total >= minTotal
}

// marketWindows 滾動年度的區間（From 含、To 不含，yyyy/MM/dd）：第 0 段是到今天為止的 12 個月
func marketWindows(now time.Time) [][2]time.Time {
	to := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.Local)
	out := make([][2]time.Time, marketListYears)
	for i := range out {
		end := to.AddDate(-i, 0, 0)
		out[i] = [2]time.Time{end.AddDate(-1, 0, 0), end}
	}
	return out
}

// marketCandidates 全部 xcity＋manual 女優各滾動年度的部數（只回有出片的）。
// 每個年度一次分組統計；同名女優照女優頁規則逐位查，不然會把同名的人算在一起
func marketCandidates(ctx context.Context, now time.Time) ([]marketCandidate, error) {
	rows, err := avRepo.NewDMMActress().FindByDomains(actressSearchDomains)
	if err != nil {
		return nil, err
	}
	nameCount := map[string]int{}
	for _, row := range rows {
		nameCount[row.Name]++
	}

	windows := marketWindows(now)
	byName := make([]map[string]actressVideoStats, len(windows))
	for i, w := range windows {
		f := avEntity.VideoStatsFilter{From: w[0].Format(topicDateLayout), To: w[1].Format(topicDateLayout), ExcludeTag: topicCompilationTag}
		if byName[i], err = statsByActressBaseName(ctx, f, false); err != nil {
			return nil, fmt.Errorf("market stats window %d: %w", i, err)
		}
	}

	var out []marketCandidate
	for _, row := range rows {
		c := marketCandidate{Row: row, Years: make([]int, len(windows))}
		if nameCount[row.Name] > 1 {
			if c.Years, err = marketCountsByRow(ctx, row, windows); err != nil {
				return nil, fmt.Errorf("market stats %s-%d: %w", row.Domain, row.ID, err)
			}
		} else {
			for i := range windows {
				c.Years[i] = byName[i][row.Name].Count
			}
		}
		for _, n := range c.Years {
			c.Total += n
		}
		if c.Total > 0 {
			out = append(out, c)
		}
	}
	return out, nil
}

// marketCountsByRow 同名女優單一位在各區間的部數（條件同女優頁本名那一頁，對照表只查一次）
func marketCountsByRow(ctx context.Context, row avEntity.DMMActress, windows [][2]time.Time) ([]int, error) {
	f, err := actressVideoFilter(row, row.Name)
	if err != nil {
		return nil, err
	}
	out := make([]int, len(windows))
	for i, w := range windows {
		from, to := entity.OnlyDateFormat(w[0]), entity.OnlyDateFormat(w[1])
		q := avEntity.VideoIndexQuery{Actresses: []avEntity.VideoActressFilter{f}}
		q.StartDate, q.EndDate = &from, &to
		s, err := avRepo.NewVideoIndex().DateStats(ctx, q)
		if err != nil {
			return nil, err
		}
		out[i] = s.Count
	}
	return out, nil
}

// RunMarketReviewCron 上市審核。P0 只做 dry-run：印出目前門檻的上市人數、不同門檻組合的人數對照表與名單前段，
// 用來校準 marketListMinPerYear／marketListMinTotal；P1 建好資料表後才會真的寫入上市
func RunMarketReviewCron() {
	ctx := context.Background()
	cands, err := marketCandidates(ctx, time.Now())
	if err != nil {
		log.Logger().Error("market review failed: " + err.Error())
		return
	}
	printMarketCalibration(cands)
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
		fmt.Printf("  %s（%s-%d）近一年 %d／前一年 %d／再前一年 %d，合計 %d\n", c.Row.Name, c.Row.Domain, c.Row.ID, c.Years[0], c.Years[1], c.Years[2], c.Total)
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

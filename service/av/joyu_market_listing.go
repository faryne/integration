package av

import (
	"context"
	"fmt"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// joyu 女優股市的上市資格（規格：DevelopDocuments/opendata/joyu.fyi女優股市_2026-11-12.md）：
// 最近 marketListYears 個滾動 12 個月，每一段都至少 marketListMinPerYear 部，合計至少 marketListMinTotal 部。
// 片數只算已配信、排除總集編（一位當紅女優一年上百部總集編，算進去上市門檻和股價都會失真），名字去掉括號別名後合併，
// 同名女優照女優頁規則逐位分
const (
	marketListYears      = 3
	marketListMinPerYear = 4
	marketListMinTotal   = 30
	// marketRecentDays 基本面看的近期區間（近 90 天部數）
	marketRecentDays = 90
)

// marketCandidate 一位女優在各滾動年度的配信部數（Years[0] 是最近 12 個月）與近 90 天部數
type marketCandidate struct {
	Row    avEntity.DMMActress
	Years  []int
	Total  int
	Recent int
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

// marketWindows 要統計的區間（From 含、To 不含）：前 marketListYears 段是滾動年度（第 0 段到今天為止），最後一段是近 90 天
func marketWindows(now time.Time) [][2]time.Time {
	to := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.Local)
	out := make([][2]time.Time, marketListYears, marketListYears+1)
	for i := range out {
		end := to.AddDate(-i, 0, 0)
		out[i] = [2]time.Time{end.AddDate(-1, 0, 0), end}
	}
	return append(out, [2]time.Time{to.AddDate(0, 0, -marketRecentDays), to})
}

// marketCandidates 全部 xcity＋manual 女優在各區間的部數（只回近三年有出片的）。
// 每個區間一次分組統計；同名女優照女優頁規則逐位查，不然會把同名的人算在一起
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
		counts := make([]int, len(windows))
		if nameCount[row.Name] > 1 {
			if counts, err = marketCountsByRow(ctx, row, windows); err != nil {
				return nil, fmt.Errorf("market stats %s-%d: %w", row.Domain, row.ID, err)
			}
		} else {
			for i := range windows {
				counts[i] = byName[i][row.Name].Count
			}
		}
		c := marketCandidate{Row: row, Years: counts[:marketListYears], Recent: counts[marketListYears]}
		for _, n := range c.Years {
			c.Total += n
		}
		if c.Total > 0 {
			out = append(out, c)
		}
	}
	return out, nil
}

// marketCountsByRow 同名女優單一位在各區間的部數（條件同女優頁本名那一頁＋排除總集編，對照表只查一次）
func marketCountsByRow(ctx context.Context, row avEntity.DMMActress, windows [][2]time.Time) ([]int, error) {
	f, err := actressVideoFilter(row, row.Name)
	if err != nil {
		return nil, err
	}
	out := make([]int, len(windows))
	for i, w := range windows {
		from, to := entity.OnlyDateFormat(w[0]), entity.OnlyDateFormat(w[1])
		q := avEntity.VideoIndexQuery{Actresses: []avEntity.VideoActressFilter{f}, ExcludeTags: []string{topicCompilationTag}}
		q.StartDate, q.EndDate = &from, &to
		s, err := avRepo.NewVideoIndex().DateStats(ctx, q)
		if err != nil {
			return nil, err
		}
		out[i] = s.Count
	}
	return out, nil
}

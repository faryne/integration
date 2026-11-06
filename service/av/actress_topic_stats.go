package av

import (
	"context"
	"fmt"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// loadActressTopicProfiles 從 MySQL 讀全部 xcity＋manual 女優（info 已套用過覆寫），算好星座，再補上出演統計
func loadActressTopicProfiles(ctx context.Context) ([]actressTopicProfile, error) {
	rows, err := avRepo.NewDMMActress().FindByDomains(actressSearchDomains)
	if err != nil {
		return nil, err
	}
	byName, err := actressStatsByName(ctx)
	if err != nil {
		return nil, fmt.Errorf("actress stats: %w", err)
	}
	nameCount := map[string]int{}
	for _, row := range rows {
		nameCount[row.Name]++
	}

	profiles := make([]actressTopicProfile, 0, len(rows))
	for _, row := range rows {
		f := actressRowFields(row)
		p := actressTopicProfile{Domain: row.Domain, AID: row.ID, Fields: f, Horoscope: horoscopeOf(f.BirthMonth, f.BirthDay), Stats: byName[row.Name]}
		// 同名女優照女優頁的規則（對照表裡的 DMM 女優 ID）逐位查，不然會把同名的人算在一起
		if nameCount[row.Name] > 1 {
			if p.Stats, err = actressStatsByRow(ctx, row); err != nil {
				return nil, fmt.Errorf("actress stats %s-%d: %w", row.Domain, row.ID, err)
			}
		}
		profiles = append(profiles, p)
	}
	return profiles, nil
}

// actressStatsByName 全部影片依出演者分組：部數、最早／最晚配信日（含總集編，跟女優頁一致）
func actressStatsByName(ctx context.Context) (map[string]actressVideoStats, error) {
	return statsByActressBaseName(ctx, avEntity.VideoStatsFilter{}, true)
}

// actressStatsByRow 單一位女優的統計，條件跟女優頁（本名那一頁）的出演影片相同（actressVideoFilter）
func actressStatsByRow(ctx context.Context, row avEntity.DMMActress) (actressVideoStats, error) {
	f, err := actressVideoFilter(row, row.Name)
	if err != nil {
		return actressVideoStats{}, err
	}
	s, err := avRepo.NewVideoIndex().DateStats(ctx, avEntity.VideoIndexQuery{Actress: &f})
	return actressVideoStats(s), err
}

// statsByActressBaseName 依出演者分組統計，名字用 actressBaseName 去掉別名後合併（「名字」和「名字（別名…）」算同一位）
func statsByActressBaseName(ctx context.Context, f avEntity.VideoStatsFilter, withDates bool) (map[string]actressVideoStats, error) {
	rows, err := avRepo.NewVideoIndex().StatsByActress(ctx, f, withDates)
	if err != nil {
		return nil, err
	}
	out := map[string]actressVideoStats{}
	for _, b := range rows {
		name := actressBaseName(b.Name)
		if name == "" {
			continue
		}
		s := out[name]
		s.Count += b.Count
		s.First = minDate(s.First, b.First)
		s.Last = max(s.Last, b.Last)
		out[name] = s
	}
	return out, nil
}

// minDate 取較早的日期，空字串視為沒有資料（vod_date 格式可以直接比字串）
func minDate(a, b string) string {
	if a == "" || (b != "" && b < a) {
		return b
	}
	return a
}

package av

import (
	"fmt"
	"slices"
	"strings"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// topicDateLayout ES dmmvideos 的 vod_date 格式，統計與主題檔案都沿用
const topicDateLayout = "2006/01/02"

// actressVideoStats 一位女優的出演統計（含總集編，跟女優頁的出演影片一致）
type actressVideoStats struct {
	Count       int
	First, Last string // vod_date，沒有影片時是空字串
}

// actressTopicProfile 套用主題條件時看的一位女優：資料欄位＋推算的星座＋出演統計
type actressTopicProfile struct {
	Domain    string
	AID       int
	Fields    avEntity.ActressFields
	Horoscope string
	Stats     actressVideoStats
}

// genreCounts 類型 → 女優名字 → 出演部數（不含總集編，名字已去掉別名）
type genreCounts map[string]map[string]int

// matchActressTopic 判斷一位女優符不符合條件。有條件但女優沒有那個欄位的資料（例如身高 0），一律不符合
func matchActressTopic(p actressTopicProfile, c avEntity.ActressTopicConditions, genres genreCounts, now time.Time) bool {
	f := p.Fields
	if len(c.Horoscope) > 0 && !slices.Contains(c.Horoscope, p.Horoscope) {
		return false
	}
	if len(c.Blood) > 0 && !slices.Contains(c.Blood, f.Blood) {
		return false
	}
	if len(c.BornCity) > 0 && !slices.Contains(c.BornCity, f.BornCity) {
		return false
	}
	diff := 0
	if f.Hips > 0 && f.Waist > 0 {
		diff = f.Hips - f.Waist
	}
	for _, r := range []struct {
		v   int
		rng [2]int
	}{{f.BirthYear, c.BirthYear}, {f.Height, c.Height}, {f.Bust, c.Bust}, {f.Waist, c.Waist}, {f.Hips, c.Hips}, {diff, c.HipWaistDiff}} {
		if !inTopicRange(r.v, r.rng) {
			return false
		}
	}
	if c.Cup != [2]string{} && !inTopicRange(cupRank(f.Cup), [2]int{cupRank(c.Cup[0]), cupRank(c.Cup[1])}) {
		return false
	}
	for _, g := range c.Genres {
		if genres[g.Tag][f.Name] < max(g.Min, 1) {
			return false
		}
	}
	if c.MinVideos > 0 && p.Stats.Count < c.MinVideos {
		return false
	}
	if c.DebutWithinMonths > 0 && !withinMonths(p.Stats.First, c.DebutWithinMonths, now) {
		return false
	}
	return c.ActiveWithinMonths <= 0 || withinMonths(p.Stats.Last, c.ActiveWithinMonths, now)
}

// inTopicRange 區間 [min, max]，0 代表那一側不限；整個區間都是 0 就不檢查
func inTopicRange(v int, r [2]int) bool {
	if r == [2]int{} {
		return true
	}
	return v > 0 && (r[0] == 0 || v >= r[0]) && (r[1] == 0 || v <= r[1])
}

// cupRank 罩杯轉成可以比大小的數字：A=1、B=2…；AA、AAA 也算 1；空字串或格式不對是 0（＝不限／沒資料）
func cupRank(cup string) int {
	cup = strings.ToUpper(strings.TrimSpace(cup))
	if cup == "" || strings.Trim(cup, "A") == "" && len(cup) <= 3 {
		return min(len(cup), 1)
	}
	if len(cup) != 1 || cup[0] < 'A' || cup[0] > 'Z' {
		return 0
	}
	return int(cup[0]-'A') + 1
}

// withinMonths 日期（vod_date 格式）在最近 n 個月內
func withinMonths(date string, n int, now time.Time) bool {
	t, err := time.ParseInLocation(topicDateLayout, date, now.Location())
	return err == nil && !t.Before(now.AddDate(0, -n, 0))
}

// topicConditionSummary 自訂主題條件的文字摘要，例如「F cup 以上・臀 90 以上」；index.json 與主題頁標題下方會用到
func topicConditionSummary(c avEntity.ActressTopicConditions) string {
	var parts []string
	if len(c.Horoscope) > 0 {
		labels := make([]string, 0, len(c.Horoscope))
		for _, s := range horoscopeSigns {
			if slices.Contains(c.Horoscope, s.Slug) {
				labels = append(labels, s.Label)
			}
		}
		parts = append(parts, strings.Join(labels, "、"))
	}
	if len(c.Blood) > 0 {
		parts = append(parts, strings.Join(c.Blood, "、")+" 型")
	}
	parts = append(parts,
		rangeSummary(c.BirthYear, "", " 年生", " 年以後出生", " 年以前出生"),
		rangeSummary(c.Height, "身高 ", "cm", "cm 以上", "cm 以下"),
		cupSummary(c.Cup),
		rangeSummary(c.Bust, "胸 ", "", " 以上", " 以下"),
		rangeSummary(c.Waist, "腰 ", "", " 以上", " 以下"),
		rangeSummary(c.Hips, "臀 ", "", " 以上", " 以下"),
		rangeSummary(c.HipWaistDiff, "臀腰差 ", "", " 以上", " 以下"),
	)
	if len(c.BornCity) > 0 {
		parts = append(parts, strings.Join(c.BornCity, "、"))
	}
	for _, g := range c.Genres {
		parts = append(parts, fmt.Sprintf("%s %d 部以上", g.Tag, max(g.Min, 1)))
	}
	if c.DebutWithinMonths > 0 {
		parts = append(parts, fmt.Sprintf("出道 %d 個月內", c.DebutWithinMonths))
	}
	if c.ActiveWithinMonths > 0 {
		parts = append(parts, fmt.Sprintf("最近 %d 個月有新作", c.ActiveWithinMonths))
	}
	if c.MinVideos > 0 {
		parts = append(parts, fmt.Sprintf("出演 %d 部以上", c.MinVideos))
	}
	return strings.Join(slices.DeleteFunc(parts, func(s string) bool { return s == "" }), "・")
}

// rangeSummary 區間的文字：兩側都有＝「身高 150～160cm」、只有下限＝「身高 168cm 以上」、只有上限＝「身高 150cm 以下」
func rangeSummary(r [2]int, prefix, unit, above, below string) string {
	switch {
	case r[0] > 0 && r[1] > 0:
		return fmt.Sprintf("%s%d～%d%s", prefix, r[0], r[1], unit)
	case r[0] > 0:
		return fmt.Sprintf("%s%d%s", prefix, r[0], above)
	case r[1] > 0:
		return fmt.Sprintf("%s%d%s", prefix, r[1], below)
	}
	return ""
}

func cupSummary(r [2]string) string {
	switch {
	case r[0] != "" && r[1] != "":
		return fmt.Sprintf("%s～%s cup", r[0], r[1])
	case r[0] != "":
		return r[0] + " cup 以上"
	case r[1] != "":
		return r[1] + " cup 以下"
	}
	return ""
}

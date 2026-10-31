package av

import (
	"cmp"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"maps"
	"slices"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// actressTopicSet 一次排程產生的全部主題：index.json 加上每個主題的檔案（key＝檔名）
type actressTopicSet struct {
	Index avEntity.ActressTopicIndex
	Files map[string]avEntity.ActressTopicFile
}

// topicBuilder 收集各分組的主題，最後依 actressTopicGroups 的順序組成 index.json；沒有人的主題不放
type topicBuilder struct {
	now    time.Time
	groups map[string][]avEntity.ActressTopicSummary
	files  map[string]avEntity.ActressTopicFile
}

func (b *topicBuilder) add(group, slug, label, file, summary, defaultSort, genreTag string, members []avEntity.ActressTopicMember) {
	if len(members) == 0 {
		return
	}
	b.groups[group] = append(b.groups[group], avEntity.ActressTopicSummary{Slug: slug, Label: label, Count: len(members), File: file, Summary: summary})
	b.files[file] = avEntity.ActressTopicFile{Slug: slug, Label: label, GeneratedAt: b.now.Format(time.RFC3339), DefaultSort: defaultSort, GenreTag: genreTag, Actresses: members}
}

func (b *topicBuilder) result() actressTopicSet {
	index := avEntity.ActressTopicIndex{GeneratedAt: b.now.Format(time.RFC3339), Groups: []avEntity.ActressTopicGroup{}}
	for _, g := range actressTopicGroups {
		if topics := b.groups[g.Key]; len(topics) > 0 {
			index.Groups = append(index.Groups, avEntity.ActressTopicGroup{Key: g.Key, Label: g.Label, Topics: topics})
		}
	}
	return actressTopicSet{Index: index, Files: b.files}
}

// buildActressTopics 產生全部主題（還沒上傳）：先算好女優統計與類型部數，再逐一套用主題條件
func buildActressTopics(ctx context.Context, now time.Time) (actressTopicSet, error) {
	profiles, err := loadActressTopicProfiles(ctx)
	if err != nil {
		return actressTopicSet{}, err
	}
	b := &topicBuilder{now: now, groups: map[string][]avEntity.ActressTopicSummary{}, files: map[string]avEntity.ActressTopicFile{}}
	filter := func(keep func(p actressTopicProfile) bool) []avEntity.ActressTopicMember {
		var out []avEntity.ActressTopicMember
		for _, p := range profiles {
			if keep(p) {
				out = append(out, topicMember(p, 0))
			}
		}
		return sortTopicMembers(out)
	}

	// 新人與活躍
	b.add(topicGroupActive, "newcomer", "新人", "newcomer.json", "", topicSortDebut, "", filter(func(p actressTopicProfile) bool {
		return withinMonths(p.Stats.First, topicNewcomerMonths, now)
	}))
	b.add(topicGroupActive, "active", "近期活躍", "active.json", "", topicSortRecent, "", filter(func(p actressTopicProfile) bool {
		return withinMonths(p.Stats.Last, topicActiveMonths, now)
	}))

	// 星座（horoscopeOf 已經排除 xcity 的預設生日 11/30）
	for _, s := range horoscopeSigns {
		slug := "horoscope-" + s.Slug
		b.add(topicGroupHoroscope, slug, s.Label, slug+".json", "", topicSortVideos, "", filter(func(p actressTopicProfile) bool { return p.Horoscope == s.Slug }))
	}

	// 出生年代、出身地：值是資料裡出現過的，人數不到門檻的不開頁
	decades := map[int]int{}
	cities := map[string]int{}
	for _, p := range profiles {
		if p.Fields.BirthYear > 0 {
			decades[p.Fields.BirthYear/10*10]++
		}
		if _, ok := prefectures[p.Fields.BornCity]; ok {
			cities[p.Fields.BornCity]++
		}
	}
	for _, d := range slices.Sorted(maps.Keys(decades)) {
		if decades[d] >= topicMinMembers {
			slug := fmt.Sprintf("born-%ds", d)
			b.add(topicGroupBorn, slug, fmt.Sprintf("%02d 年代", d%100), slug+".json", "", topicSortVideos, "", filter(func(p actressTopicProfile) bool {
				return p.Fields.BirthYear/10*10 == d
			}))
		}
	}
	for _, city := range slices.SortedFunc(maps.Keys(cities), func(a, c string) int { return cmp.Compare(cities[c], cities[a]) }) {
		if cities[city] >= topicMinMembers {
			slug := "pref-" + prefectures[city]
			b.add(topicGroupPref, slug, city, slug+".json", "", topicSortVideos, "", filter(func(p actressTopicProfile) bool { return p.Fields.BornCity == city }))
		}
	}

	// 自訂主題（身材；第 3 階段改從 DB 讀，連同特輯）：條件裡用到的類型先算好部數
	counter := newGenreCounter(ctx)
	for _, def := range bodyTopicDefs {
		for _, g := range def.Conditions.Genres {
			if _, err := counter.get(g.Tag); err != nil {
				return actressTopicSet{}, fmt.Errorf("genre %s: %w", g.Tag, err)
			}
		}
		genreTag := ""
		if gs := def.Conditions.Genres; len(gs) > 0 {
			genreTag = gs[0].Tag
		}
		var members []avEntity.ActressTopicMember
		for _, p := range profiles {
			if matchActressTopic(p, def.Conditions, counter.counts, now) {
				members = append(members, topicMember(p, counter.counts[genreTag][p.Fields.Name]))
			}
		}
		b.add(def.Group, def.Slug, def.Label, def.Slug+".json", topicConditionSummary(def.Conditions), def.DefaultSort, genreTag, sortTopicMembers(members))
	}

	// 類型：facet 挑熱門／冷門，排行只列女優資料存在的名字
	tags, err := fetchGenreTags(ctx)
	if err != nil {
		return actressTopicSet{}, fmt.Errorf("genre tags: %w", err)
	}
	genreMembers := func(tag string) ([]avEntity.ActressTopicMember, error) {
		counts, err := counter.get(tag)
		if err != nil {
			return nil, err
		}
		var out []avEntity.ActressTopicMember
		for _, p := range profiles {
			if n := counts[p.Fields.Name]; n >= topicGenreMinVideos {
				out = append(out, topicMember(p, n))
			}
		}
		slices.SortStableFunc(out, func(a, c avEntity.ActressTopicMember) int { return cmp.Compare(c.GenreCount, a.GenreCount) })
		return out[:min(len(out), topicGenreMaxMembers)], nil
	}
	hot, cold, err := pickGenreTopics(tags, func(tag string) (int, error) {
		m, err := genreMembers(tag)
		return len(m), err
	})
	if err != nil {
		return actressTopicSet{}, fmt.Errorf("pick genres: %w", err)
	}
	for _, list := range []struct {
		group string
		tags  []topicTagCount
	}{{topicGroupHotGenre, hot}, {topicGroupColdGenre, cold}} {
		for _, t := range list.tags {
			members, err := genreMembers(t.Tag)
			if err != nil {
				return actressTopicSet{}, fmt.Errorf("genre %s: %w", t.Tag, err)
			}
			b.add(list.group, "genre-"+t.Tag, t.Tag, genreTopicFile(t.Tag), "", topicSortGenre, t.Tag, members)
		}
	}
	return b.result(), nil
}

// topicMember 主題卡片的一筆；genreCount 為 0 時 JSON 會省略
func topicMember(p actressTopicProfile, genreCount int) avEntity.ActressTopicMember {
	return avEntity.ActressTopicMember{
		Domain: p.Domain, AID: p.AID, Name: p.Fields.Name, Photo: p.Fields.Photo,
		VideoCount: p.Stats.Count, FirstVodDate: p.Stats.First, LastVodDate: p.Stats.Last, GenreCount: genreCount,
	}
}

// sortTopicMembers 檔案裡先依出演數排好（前端還是會依使用者選的方式重排），讓輸出穩定
func sortTopicMembers(m []avEntity.ActressTopicMember) []avEntity.ActressTopicMember {
	slices.SortStableFunc(m, func(a, c avEntity.ActressTopicMember) int { return cmp.Compare(c.VideoCount, a.VideoCount) })
	return m
}

// genreTopicFile 類型主題的檔名用標籤的雜湊，避開「・」、空白等字元在 S3／網址的編碼問題
func genreTopicFile(tag string) string {
	sum := sha1.Sum([]byte(tag))
	return "genre-" + hex.EncodeToString(sum[:4]) + ".json"
}

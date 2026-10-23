package vtuber

import vtuberEntity "faryne.dev/model/entity/opendata/vtuber"

// Units 官網分組（/talents?gp=<slug>），順序跟官網一致，也是全部藝人面板的分段順序。
// 一位藝人可能同時在好幾組（例如白上フブキ是 1期生也是ゲーマーズ），依這個順序取第一組當她的期別，畫面上才不會重複出現。
// 卒業生（graduatedUnit）不在這張表：畢業的人仍掛在原本的期別下，只另外標記 is_graduated。
// 官網新增分組時要補在這裡；沒補的話藝人仍會寫入 unit_slug，前端歸到「其他」，週更 job 也會 warn。
var Units = []vtuberEntity.Unit{
	{Slug: "gen-0", Name: "0期生", Branch: "JP"},
	{Slug: "1stgen", Name: "1期生", Branch: "JP"},
	{Slug: "gen-2", Name: "2期生", Branch: "JP"},
	{Slug: "gamers", Name: "ゲーマーズ", Branch: "JP"},
	{Slug: "gen-3", Name: "3期生", Branch: "JP"},
	{Slug: "gen-4", Name: "4期生", Branch: "JP"},
	{Slug: "gen-5", Name: "5期生", Branch: "JP"},
	{Slug: "holox", Name: "秘密結社holoX", Branch: "JP"},
	{Slug: "asobi-mawari-tai", Name: "アソビ★まわり隊！", Branch: "JP"},
	{Slug: "area15", Name: "AREA15", Branch: "ID"},
	{Slug: "holoro", Name: "holoro", Branch: "ID"},
	{Slug: "holoh3ro", Name: "holoh3ro", Branch: "ID"},
	{Slug: "myth", Name: "Myth", Branch: "EN"},
	{Slug: "project-hope", Name: "Project: HOPE", Branch: "EN"},
	{Slug: "council", Name: "Council", Branch: "EN"},
	{Slug: "promise", Name: "Promise", Branch: "EN"},
	{Slug: "advent", Name: "Advent", Branch: "EN"},
	{Slug: "justice", Name: "Justice", Branch: "EN"},
	{Slug: "regloss", Name: "ReGLOSS", Branch: "DEV_IS"},
	{Slug: "flow-glow", Name: "FLOW GLOW", Branch: "DEV_IS"},
	// holoAN、事務所スタッフ（工作人員）也列出來，歸到 OTHER 分部
	{Slug: "holoan", Name: "holoAN", Branch: "OTHER"},
	{Slug: "tag_office-staff", Name: "事務所スタッフ", Branch: "OTHER"},
}

// graduatedUnit 官網的卒業生分組：成員只標記 is_graduated，不當成期別
const graduatedUnit = "alum"

// unitRank 分組 slug → 在 Units 裡的順序，數字小的優先；不在表裡的新分組排最後
func unitRank(slug string) int {
	for i, u := range Units {
		if u.Slug == slug {
			return i
		}
	}
	return len(Units)
}

// FindUnit 依 slug 找分組；不在表裡回 nil
func FindUnit(slug string) *vtuberEntity.Unit {
	for i := range Units {
		if Units[i].Slug == slug {
			return &Units[i]
		}
	}
	return nil
}

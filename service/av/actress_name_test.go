package av

import (
	"slices"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// prod 上實際出現過的寫法
func TestParseActressAlias(t *testing.T) {
	cases := []struct {
		name    string
		base    string
		aliases []string
	}{
		{"澤村レイコ（高坂保奈美、高坂ますみ）", "澤村レイコ", []string{"高坂保奈美", "高坂ますみ"}},
		{"七空うみ(七海そら)", "七空うみ", []string{"七海そら"}},
		{"みひな （あずみひな、永井みひな）", "みひな", []string{"あずみひな", "永井みひな"}},
		{"江波りゅう（RYU)", "江波りゅう", []string{"RYU"}},
		{"シェリー（Shelly、藤井シェリー）（しぇりー）", "シェリー", []string{"Shelly", "藤井シェリー", "しぇりー"}},
		{"ミア・楓・キャメロン（ミア・マルコヴァ）", "ミア・楓・キャメロン", []string{"ミア・マルコヴァ"}},
		{"川上ゆう", "川上ゆう", nil},
	}
	for _, c := range cases {
		base, aliases := parseActressAlias(c.name)
		if base != c.base || !slices.Equal(aliases, c.aliases) {
			t.Errorf("%s: got %q %q", c.name, base, aliases)
		}
		if actressBaseName(c.name) != c.base {
			t.Errorf("%s: base %q", c.name, actressBaseName(c.name))
		}
	}
}

func TestMergeActressAliases(t *testing.T) {
	got := mergeActressAliases("川上ゆう", []string{" 森野雫 ", "川上ゆう", ""}, []string{"森野雫", "若菜"})
	if !slices.Equal(got, []string{"森野雫", "若菜"}) {
		t.Errorf("got %q", got)
	}
}

func TestPickAliasTarget(t *testing.T) {
	a := avEntity.DMMActress{Domain: "xcity", ID: 1, Name: "澤村レイコ"}
	b := avEntity.DMMActress{Domain: "xcity", ID: 2, Name: "稲森しほり"}
	c := avEntity.DMMActress{Domain: "xcity", ID: 3, Name: "愛乃彩音"}
	byName := map[string][]avEntity.DMMActress{
		a.Name: {a}, b.Name: {b}, c.Name: {c},
		"同名": {{Domain: "xcity", ID: 4, Name: "同名"}, {Domain: "manual", ID: 5, Name: "同名"}},
	}
	cases := []struct {
		group []string
		want  int
	}{
		{[]string{"澤村レイコ", "高坂保奈美"}, 1},         // 本名對到
		{[]string{"芦名未帆", "稲森しほり"}, 2},          // 本名沒人，別名剛好一位
		{[]string{"松下ゆうか", "稲森しほり", "愛乃彩音"}, 0}, // 別名對到兩位，分不出來
		{[]string{"同名", "別名"}, 0},               // 本名是同名女優
		{[]string{"沒人", "也沒人"}, 0},
	}
	for _, c := range cases {
		row, ok := pickAliasTarget(c.group, byName)
		if got := map[bool]int{true: row.ID, false: 0}[ok]; got != c.want {
			t.Errorf("%q: got %d want %d", c.group, got, c.want)
		}
	}
}

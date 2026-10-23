package vtuber

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseTalentSlugsFromUnitPage(t *testing.T) {
	body, err := os.ReadFile("testdata/talents_gp_gen3.html")
	require.NoError(t, err)
	// 分組頁只列該組成員（2026-10-23 官網的 3期生）
	require.ElementsMatch(t, []string{"usada-pekora", "shiranui-flare", "shirogane-noel", "houshou-marine"}, parseTalentSlugs(string(body)))
}

func TestParseUnitSlugs(t *testing.T) {
	// 卒業生、事務所スタッフ也要抓（用來排除成員），只去重
	body := `<a href="/talents?gp=gen-0">0期生</a><a href="/talents?gp=myth">Myth</a><a href="/talents?gp=alum">卒業生</a>` +
		`<a href="/talents?gp=tag_office-staff">事務所スタッフ</a><a href="/talents?gp=myth">Myth</a>`
	require.Equal(t, []string{"gen-0", "myth", "alum", "tag_office-staff"}, parseUnitSlugs(body))
}

func TestAssignUnitPrefersEarlierUnit(t *testing.T) {
	out := map[string]string{}
	// ゲーマーズ先抓到，1期生後抓到：仍以 Units 順序較前的 1期生為準
	assignUnit(out, "gamers", []string{"shirakami-fubuki", "inugami-korone"})
	assignUnit(out, "1stgen", []string{"shirakami-fubuki"})
	// 不在表裡的新分組排最後，不會蓋掉既有期別
	assignUnit(out, "brand-new-unit", []string{"inugami-korone", "newcomer"})
	require.Equal(t, map[string]string{"shirakami-fubuki": "1stgen", "inugami-korone": "gamers", "newcomer": "brand-new-unit"}, out)
}

func TestApplyUnitPageKeepsGraduatesInOriginalUnit(t *testing.T) {
	units, graduated := map[string]string{}, map[string]bool{}
	// 卒業生分組不論先抓或後抓，都只標記畢業，期別維持原本的
	applyUnitPage(units, graduated, "gen-4", []string{"amane-kanata", "tokoyami-towa"})
	applyUnitPage(units, graduated, "alum", []string{"amane-kanata", "kiryu-coco"})
	applyUnitPage(units, graduated, "gen-4", []string{"kiryu-coco"})
	require.Equal(t, map[string]string{"amane-kanata": "gen-4", "tokoyami-towa": "gen-4", "kiryu-coco": "gen-4"}, units)
	require.Equal(t, map[string]bool{"amane-kanata": true, "kiryu-coco": true}, graduated)
}

func TestGraduationAllowed(t *testing.T) {
	require.True(t, graduationAllowed(79, 0)) // 第一次跑
	require.True(t, graduationAllowed(64, 80))
	require.False(t, graduationAllowed(63, 80)) // 不到 80%，可能是官網改版爬空
	require.False(t, graduationAllowed(0, 0))
}

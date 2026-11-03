package vtuber

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

func TestUnitGuardReason(t *testing.T) {
	// 20 位在籍藝人，全部是 gen-1；門檻 20% ＝ 4 人
	active := make([]vtuberEntity.Channel, 20)
	for i := range active {
		active[i] = vtuberEntity.Channel{ChannelID: fmt.Sprintf("UC%02d", i), UnitSlug: optional("gen-1")}
	}
	clone := func() []vtuberEntity.Channel { return append([]vtuberEntity.Channel(nil), active...) }

	// 沒有變動
	require.Empty(t, unitGuardReason(clone(), active, true))

	// 列表頁一個分組都沒抓到
	require.Contains(t, unitGuardReason(clone(), active, false), "一個分組都沒抓到")

	// 一人畢業、三人換組、加上新出道的頻道（DB 沒有，不算變動）：剛好 4 人，不擋
	rows := clone()
	rows[0].IsGraduated = true
	for i := 1; i <= 3; i++ {
		rows[i].UnitSlug = optional("gamers")
	}
	rows = append(rows, vtuberEntity.Channel{ChannelID: "UCnew", UnitSlug: optional("gen-6")})
	require.Empty(t, unitGuardReason(rows, active, true))

	// 第 5 人有變動就超過門檻
	rows[4].IsGraduated = true
	require.Contains(t, unitGuardReason(rows, active, true), "5／20")

	// 只要有人原本有期別這次變成空的就擋，不看人數
	rows = clone()
	rows[7].UnitSlug = nil
	require.Contains(t, unitGuardReason(rows, active, true), "1 位原本有期別")

	// 第一次跑：DB 沒資料，不擋
	require.Empty(t, unitGuardReason(clone(), nil, true))
}

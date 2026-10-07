package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func testLoreDirectory() loreTargetDirectory {
	return newLoreTargetDirectory(
		[]storytellerModel.Story{
			{ID: 1, PublicID: "s1", Title: "第一話"},
			{ID: 2, PublicID: "vol", Title: "第一冊", IsVolume: true},
		},
		[]storytellerModel.Lore{{ID: 10, PublicID: "l10", Title: "白瀨澪"}, {ID: 11, PublicID: "l11", Title: "第零席"}},
	)
}

func dep(kind storytellerModel.ReadingTargetType, publicID string) storytellerModel.LoreDependencyRef {
	return storytellerModel.LoreDependencyRef{TargetType: kind, TargetPublicID: publicID}
}

func TestResolveLoreDependenciesKeepsOrderAndDedupes(t *testing.T) {
	rows, err := resolveLoreDependencies(testLoreDirectory(), 11, []storytellerModel.LoreDependencyRef{
		dep(storytellerModel.ReadingTargetLore, "l10"), dep(storytellerModel.ReadingTargetStory, "s1"), dep(storytellerModel.ReadingTargetLore, "l10"),
	})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, uint64(10), rows[0].TargetID)
	require.Equal(t, 1, rows[1].Sort)
}

func TestResolveLoreDependenciesRejectsInvalidTargets(t *testing.T) {
	dir := testLoreDirectory()
	cases := map[string]storytellerModel.LoreDependencyRef{
		"自己":     dep(storytellerModel.ReadingTargetLore, "l11"),
		"冊不能當依賴": dep(storytellerModel.ReadingTargetStory, "vol"),
		"不存在":    dep(storytellerModel.ReadingTargetStory, "nope"),
		"種類對不上":  dep(storytellerModel.ReadingTargetStory, "l10"),
	}
	for name, ref := range cases {
		_, err := resolveLoreDependencies(dir, 11, []storytellerModel.LoreDependencyRef{ref})
		require.Error(t, err, name)
	}
}

func TestFillLoreDependenciesDropsUnreadableTargets(t *testing.T) {
	// 公開頁的對照表只有讀者讀得到的對象：第一話未公開時，依賴裡就不該出現它的標題
	publicDir := newLoreTargetDirectory(nil, []storytellerModel.Lore{{ID: 10, PublicID: "l10", Title: "白瀨澪"}, {ID: 11, PublicID: "l11"}})
	lores := []storytellerModel.Lore{{ID: 11, PublicID: "l11"}}
	fillLoreDependencies(lores, []storytellerModel.LoreDependency{
		{LoreID: 11, TargetType: storytellerModel.ReadingTargetStory, TargetID: 1},
		{LoreID: 11, TargetType: storytellerModel.ReadingTargetLore, TargetID: 10},
	}, publicDir)
	require.Equal(t, []storytellerModel.LoreDependencyRef{{TargetType: storytellerModel.ReadingTargetLore, TargetPublicID: "l10", Title: "白瀨澪"}}, lores[0].DependsOn)
}

func TestLorePublicIDsFromContentCoversAllForms(t *testing.T) {
	content := "見⟦a-x1 href=\"steamloom-lore://def456\"⟧中控室⟦/a-x1⟧，" +
		`{"pages":[{"description":"⟦a-x2 href=\"steamloom-lore://abc123\"⟧澪⟦/a-x2⟧"}]}`
	require.ElementsMatch(t, []string{"abc123", "def456"}, lorePublicIDsFromContent(content))
}

func TestWordCountIgnoresLoreLinkURI(t *testing.T) {
	require.Equal(t, wordCount("白瀨澪"), wordCount("⟦a-x1 href=\"steamloom-lore://abc123\"⟧白瀨澪⟦/a-x1⟧"))
}

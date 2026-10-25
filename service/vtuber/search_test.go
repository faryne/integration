package vtuber

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeKeyword(t *testing.T) {
	got, err := normalizeKeyword("  歌枠   KARAOKE \n")
	require.NoError(t, err)
	require.Equal(t, "歌枠 KARAOKE", got)

	_, err = normalizeKeyword(strings.Repeat("あ", maxSearchKeywordRunes+1))
	require.ErrorIs(t, err, ErrInvalidRequest)
}

func TestDescriptionSnippet(t *testing.T) {
	desc := "魔界学校のバーチャル保健医癒月ちょこと申します！チョコのような甘くとろけるような癒しのひとときをあなたに\nファンアート【 #しょこらーと】"
	// 命中在後段：從命中前 12 字開始、前面補「…」，換行收成空格
	got := descriptionSnippet(desc, "しょこら")
	require.True(t, strings.HasPrefix(got, "…"))
	require.Contains(t, got, "ファンアート【 #しょこらーと】")

	// 不分大小寫
	require.Contains(t, descriptionSnippet("The Grim Reaper's first apprentice", "REAPER"), "Reaper")

	// Go 找不到（DB 比對比較寬鬆）時取開頭
	require.True(t, strings.HasPrefix(descriptionSnippet(desc, "ＸＹＺ"), "魔界学校"))
}

func TestMatchingUnitSlugs(t *testing.T) {
	require.Contains(t, matchingUnitSlugs("3期"), "gen-3")
	require.Empty(t, matchingUnitSlugs("沒有這個期別"))
}

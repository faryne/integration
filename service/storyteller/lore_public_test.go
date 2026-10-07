package storyteller

import (
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestApplyLorePublishingDefaultsNewLoreToDraft(t *testing.T) {
	lore := &storytellerModel.Lore{}
	require.NoError(t, applyLorePublishing(lore, storytellerModel.LoreRequest{}))
	require.Equal(t, storytellerModel.StoryStatusDraft, lore.Status)
}

func TestApplyLorePublishingKeepsFieldsWhenOmitted(t *testing.T) {
	// 編輯頁自動存檔不會帶公開狀態與摘要，不能因此把已公開的設定改回草稿
	lore := &storytellerModel.Lore{Status: storytellerModel.StoryStatusCompleted, Summary: "原本的摘要"}
	require.NoError(t, applyLorePublishing(lore, storytellerModel.LoreRequest{Title: "新標題"}))
	require.Equal(t, storytellerModel.StoryStatusCompleted, lore.Status)
	require.Equal(t, "原本的摘要", lore.Summary)
}

func TestApplyLorePublishingValidatesInput(t *testing.T) {
	bad := storytellerModel.StoryStatus("public")
	require.Error(t, applyLorePublishing(&storytellerModel.Lore{}, storytellerModel.LoreRequest{Status: &bad}))
	long := strings.Repeat("設", loreSummaryMaxRunes+1)
	require.Error(t, applyLorePublishing(&storytellerModel.Lore{}, storytellerModel.LoreRequest{Summary: &long}))

	published := storytellerModel.StoryStatusCompleted
	summary := "  角色簡介  "
	lore := &storytellerModel.Lore{}
	require.NoError(t, applyLorePublishing(lore, storytellerModel.LoreRequest{Status: &published, Summary: &summary}))
	require.Equal(t, storytellerModel.StoryStatusCompleted, lore.Status)
	require.Equal(t, "角色簡介", lore.Summary)
}

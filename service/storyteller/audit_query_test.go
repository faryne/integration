package storyteller

import (
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type fakeAuditQueryRepository struct {
	query       storytellerModel.AuditEventQuery
	projects    []storytellerModel.Project
	events      []storytellerModel.AuditEvent
	credentials []storytellerModel.PersonalAccessToken
	targetNames map[storytellerModel.AuditTargetRef]string
}

func (f *fakeAuditQueryRepository) AuditEvents(q storytellerModel.AuditEventQuery) ([]storytellerModel.AuditEvent, error) {
	f.query = q
	return f.events, nil
}

func (f *fakeAuditQueryRepository) AuditUserDisplayNames(userIDs []uint64) (map[uint64]string, error) {
	names := map[uint64]string{}
	for _, id := range userIDs {
		names[id] = "Faryne"
	}
	return names, nil
}

func (f *fakeAuditQueryRepository) AuditCredentials(uint64, []string) ([]storytellerModel.PersonalAccessToken, error) {
	return f.credentials, nil
}

func (f *fakeAuditQueryRepository) AuditTargetNames(uint64, []storytellerModel.AuditTargetRef) (map[storytellerModel.AuditTargetRef]string, error) {
	return f.targetNames, nil
}

func (f *fakeAuditQueryRepository) AuditProjectByPublicID(_ uint64, publicID string) (*storytellerModel.Project, error) {
	for _, project := range f.projects {
		if project.PublicID == publicID {
			return &project, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (f *fakeAuditQueryRepository) AuditProjectOptions(uint64) ([]storytellerModel.Project, error) {
	return f.projects, nil
}

func auditStringPointer(value string) *string { return &value }

var auditTestNow = time.Date(2026, 9, 27, 12, 0, 0, 0, time.UTC)

func TestBuildAuditEventQueryDefaultsToLast24HoursAndHidesLowImportance(t *testing.T) {
	query, hotFrom, err := buildAuditEventQuery(4, storytellerModel.AuditEventListParams{}, auditTestNow, 3)
	require.NoError(t, err)
	require.Equal(t, auditTestNow.Add(-24*time.Hour), query.From)
	require.Equal(t, auditTestNow, query.To)
	require.Equal(t, auditTestNow.AddDate(0, -3, 0), hotFrom)
	require.Equal(t, auditEventDefaultLimit, query.Limit)
	require.Contains(t, query.ExcludeActions, "story.read")
	require.Contains(t, query.ExcludeActions, "favorite.add")
	require.NotContains(t, query.ExcludeActions, "story.update")
}

func TestBuildAuditEventQueryExplicitCategoryKeepsLowImportance(t *testing.T) {
	query, _, err := buildAuditEventQuery(4, storytellerModel.AuditEventListParams{Category: "read"}, auditTestNow, 3)
	require.NoError(t, err)
	require.Empty(t, query.ExcludeActions)
	require.Contains(t, query.Actions, "story.read")
}

func TestBuildAuditEventQueryCredentialFilterIncludesReads(t *testing.T) {
	query, _, err := buildAuditEventQuery(4, storytellerModel.AuditEventListParams{CredentialRef: "pat_a"}, auditTestNow, 3)
	require.NoError(t, err)
	require.Empty(t, query.ExcludeActions, "追查某支 PAT 時要看得到它的讀取紀錄")
	require.Equal(t, "pat_a", query.CredentialRef)
}

func TestBuildAuditEventQueryRejectsRangeOlderThanHotWindow(t *testing.T) {
	from := auditTestNow.AddDate(0, -4, 0).Format(time.RFC3339)
	_, _, err := buildAuditEventQuery(4, storytellerModel.AuditEventListParams{From: from}, auditTestNow, 3)
	require.ErrorIs(t, err, ErrAuditArchiveRequired)
}

func TestBuildAuditEventQueryRejectsInvalidFilters(t *testing.T) {
	for _, params := range []storytellerModel.AuditEventListParams{
		{Category: "unknown"}, {Source: "ftp"}, {Source: "cron"}, {Source: "api"}, {Outcome: "maybe"},
		{CredentialRef: "pat'; DROP"}, {From: "yesterday"},
		{From: auditTestNow.Format(time.RFC3339), To: auditTestNow.Add(-time.Hour).Format(time.RFC3339)},
	} {
		_, _, err := buildAuditEventQuery(4, params, auditTestNow, 3)
		require.ErrorIs(t, err, ErrAuditFilterInvalid, "params %+v", params)
	}
	_, _, err := buildAuditEventQuery(4, storytellerModel.AuditEventListParams{Cursor: "@@@"}, auditTestNow, 3)
	require.ErrorIs(t, err, ErrAuditCursorInvalid)
}

func TestBuildAuditEventQueryClampsLimit(t *testing.T) {
	query, _, err := buildAuditEventQuery(4, storytellerModel.AuditEventListParams{Limit: 1000}, auditTestNow, 3)
	require.NoError(t, err)
	require.Equal(t, auditEventMaxLimit, query.Limit)
}

func TestAuditCursorRoundTrip(t *testing.T) {
	at := time.Date(2026, 9, 27, 10, 11, 12, 345678000, time.UTC)
	decodedAt, decodedID, err := decodeAuditCursor(encodeAuditCursor(at, 42))
	require.NoError(t, err)
	require.True(t, at.Equal(decodedAt))
	require.Equal(t, uint64(42), decodedID)
}

func TestListAuditEventsPaginatesAndMapsOutput(t *testing.T) {
	actorID := uint64(4)
	older := auditTestNow.Add(-2 * time.Hour)
	repo := &fakeAuditQueryRepository{
		events: []storytellerModel.AuditEvent{
			{ID: 3, EventID: "E3", OccurredAt: auditTestNow.Add(-time.Hour), ActorType: storytellerModel.AuditActorTypeUser, ActorUserID: &actorID,
				Source: storytellerModel.AuditSourceMCP, AuthMethod: storytellerModel.AuditAuthMethodPAT, CredentialRef: auditStringPointer("pat_live"),
				Action: "story.update", TargetType: auditStringPointer("story"), TargetPublicID: auditStringPointer("story-1"),
				Outcome: storytellerModel.AuditOutcomeSuccess, Summary: storytellerModel.AuditSummary{"version_id": 7, "id": 99}},
			{ID: 2, EventID: "E2", OccurredAt: older, ActorType: storytellerModel.AuditActorTypeUser, ActorUserID: &actorID,
				Source: storytellerModel.AuditSourceMCP, AuthMethod: storytellerModel.AuditAuthMethodPAT, CredentialRef: auditStringPointer("pat_gone"),
				Action: "volume.update", TargetType: auditStringPointer("volume"), TargetPublicID: auditStringPointer("vol-1"),
				Outcome: storytellerModel.AuditOutcomeSuccess},
			{ID: 1, EventID: "E1", OccurredAt: older.Add(-time.Minute), Action: "story.update", Outcome: storytellerModel.AuditOutcomeSuccess},
		},
		credentials: []storytellerModel.PersonalAccessToken{{PublicID: "pat_live", Label: "Codex 桌機"}},
		targetNames: map[storytellerModel.AuditTargetRef]string{
			{Type: "story", PublicID: "story-1"}: "第三章",
			{Type: "story", PublicID: "vol-1"}:   "卷一",
		},
	}
	page, err := listAuditEvents(repo, 4, storytellerModel.AuditEventListParams{Limit: 2}, auditTestNow, 3)
	require.NoError(t, err)
	require.Len(t, page.Events, 2)
	require.True(t, page.HasMore)
	cursorAt, cursorID, err := decodeAuditCursor(page.NextCursor)
	require.NoError(t, err)
	require.True(t, older.Equal(cursorAt))
	require.Equal(t, uint64(2), cursorID)

	first := page.Events[0]
	require.Equal(t, "Faryne", first.Actor.DisplayName)
	require.Equal(t, "story", first.Category)
	require.Equal(t, "Codex 桌機", first.Credential.Label)
	require.False(t, first.Credential.Revoked)
	require.Equal(t, "第三章", first.Target.Name)
	require.Equal(t, storytellerModel.AuditSummary{"version_id": 7}, first.Summary, "內部數字 id 不可外露")

	second := page.Events[1]
	require.Equal(t, "已撤銷的憑證", second.Credential.Label)
	require.True(t, second.Credential.Revoked)
	require.Equal(t, "卷一", second.Target.Name, "volume 與 story 共用名稱查詢")
}

func TestAuditEventFiltersListProjectsSourcesAndCredentials(t *testing.T) {
	deletedAt := auditTestNow
	repo := &fakeAuditQueryRepository{
		credentials: []storytellerModel.PersonalAccessToken{
			{PublicID: "pat_a", Label: "桌機"}, {PublicID: "pat_b", Label: "舊筆電", IsDeleted: true},
		},
		projects: []storytellerModel.Project{
			{PublicID: "p1", Name: "霧港殘響"}, {PublicID: "p2", Name: "舊企劃", DeletedAt: &deletedAt},
		},
	}
	filters, err := auditEventFilters(repo, 4)
	require.NoError(t, err)
	require.Contains(t, filters.Categories, "auth")
	require.NotContains(t, filters.Categories, "system", "系統事件沒有操作者，不會出現在本人活動")
	require.Equal(t, []storytellerModel.AuditSource{storytellerModel.AuditSourceWeb, storytellerModel.AuditSourceMCP}, filters.Sources)
	require.Equal(t, "舊筆電（已撤銷）", filters.Credentials[1].Label)
	require.Equal(t, "舊企劃（已刪除）", filters.Projects[1].Label)
}

func TestListAuditEventsResolvesProjectFilterWithinOwnProjects(t *testing.T) {
	repo := &fakeAuditQueryRepository{projects: []storytellerModel.Project{{ID: 9, PublicID: "p1"}}}
	_, err := listAuditEvents(repo, 4, storytellerModel.AuditEventListParams{ProjectPublicID: "p1"}, auditTestNow, 3)
	require.NoError(t, err)
	require.Equal(t, uint64(4), repo.query.UserID)
	require.Equal(t, uint64(9), *repo.query.ProjectID)

	_, err = listAuditEvents(repo, 4, storytellerModel.AuditEventListParams{ProjectPublicID: "someone-elses"}, auditTestNow, 3)
	require.ErrorIs(t, err, ErrAuditFilterInvalid, "不是本人的專案一律當成篩選錯誤，不透露是否存在")
}

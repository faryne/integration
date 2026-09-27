package storyteller

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	"github.com/stretchr/testify/require"
)

type fakeArchiveStore struct {
	objects  map[string][]byte
	retain   map[string]time.Time
	deleted  []string
	failOn   string
	putError error
}

func (f *fakeArchiveStore) PutArchiveObject(_ context.Context, key string, body []byte, retainUntil time.Time) error {
	if f.putError != nil {
		return f.putError
	}
	if f.objects == nil {
		f.objects, f.retain = map[string][]byte{}, map[string]time.Time{}
	}
	f.objects[key], f.retain[key] = append([]byte(nil), body...), retainUntil
	return nil
}

func (f *fakeArchiveStore) DeleteArchivePrefix(_ context.Context, prefix string) (int, error) {
	if prefix == f.failOn {
		return 0, errors.New("object is locked")
	}
	f.deleted = append(f.deleted, prefix)
	return 1, nil
}

type fakeArchiveRepo struct {
	fakeAuditQueryRepository
	events         []storytellerModel.AuditEvent
	archived       map[uint64]bool // 已標記封存的 event id
	commitErr      error
	exports        []storytellerModel.AuditExport
	saved          []storytellerModel.AuditExport
	purgedColumns  []string // "月份 欄位"
	deletedRanges  [][2]time.Time
	deleteResult   int64
	createdQueries []*storytellerModel.AuditArchiveQuery
}

func (f *fakeArchiveRepo) AuditEarliestEventTime() (*time.Time, error) {
	if len(f.events) == 0 {
		return nil, nil
	}
	earliest := f.events[0].OccurredAt
	return &earliest, nil
}

func (f *fakeArchiveRepo) AuditEventsForExport(from, to time.Time, afterAt *time.Time, afterID uint64, limit int) ([]storytellerModel.AuditEvent, error) {
	rows := make([]storytellerModel.AuditEvent, 0)
	for _, event := range f.events {
		if event.OccurredAt.Before(from) || !event.OccurredAt.Before(to) || f.archived[event.ID] {
			continue
		}
		if afterAt != nil && (event.OccurredAt.Before(*afterAt) || event.OccurredAt.Equal(*afterAt) && event.ID <= afterID) {
			continue
		}
		rows = append(rows, event)
		if len(rows) == limit {
			break
		}
	}
	return rows, nil
}

func (f *fakeArchiveRepo) CommitAuditExport(row *storytellerModel.AuditExport, eventIDs []uint64, _ time.Time) error {
	if f.commitErr != nil {
		return f.commitErr
	}
	if f.archived == nil {
		f.archived = map[uint64]bool{}
	}
	for _, id := range eventIDs {
		f.archived[id] = true
	}
	f.saved = append(f.saved, *row)
	return nil
}

func (f *fakeArchiveRepo) AuditExports() ([]storytellerModel.AuditExport, error) {
	return f.exports, nil
}

func (f *fakeArchiveRepo) SaveAuditExport(row *storytellerModel.AuditExport) error {
	f.saved = append(f.saved, *row)
	return nil
}

func (f *fakeArchiveRepo) SetAuditExportPurgedAt(month string, column storytellerRepo.AuditExportPurgedColumn, _ time.Time) error {
	f.purgedColumns = append(f.purgedColumns, month+" "+string(column))
	return nil
}

func (f *fakeArchiveRepo) DeleteAuditEventsBetween(from, to time.Time, _ int) (int64, error) {
	f.deletedRanges = append(f.deletedRanges, [2]time.Time{from, to})
	return f.deleteResult, nil
}

func (f *fakeArchiveRepo) CreateAuditArchiveQuery(row *storytellerModel.AuditArchiveQuery) error {
	row.CreatedAt = time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	f.createdQueries = append(f.createdQueries, row)
	return nil
}

func (f *fakeArchiveRepo) AuditArchiveQueryByPublicID(uint64, string) (*storytellerModel.AuditArchiveQuery, error) {
	return f.createdQueries[0], nil
}

func (f *fakeArchiveRepo) SaveAuditArchiveQuery(*storytellerModel.AuditArchiveQuery) error {
	return nil
}

type fakeQueryEngine struct {
	sql         string
	params      []string
	startErr    error
	state       string
	completedAt *time.Time
	pages       map[string][][]string
	next        map[string]string
}

func (f *fakeQueryEngine) StartQuery(_ context.Context, sql string, params []string) (string, error) {
	f.sql, f.params = sql, params
	return "exec-1", f.startErr
}

func (f *fakeQueryEngine) QueryStatus(context.Context, string) (auditArchiveQueryStatus, error) {
	scanned := uint64(2048)
	return auditArchiveQueryStatus{State: f.state, ScannedBytes: &scanned, CompletedAt: f.completedAt}, nil
}

func (f *fakeQueryEngine) QueryResults(_ context.Context, _ string, token string, _ int32) ([][]string, string, error) {
	return f.pages[token], f.next[token], nil
}

func archiveTestEvent(id uint64, at time.Time) storytellerModel.AuditEvent {
	project := uint64(9)
	return storytellerModel.AuditEvent{
		ID: id, EventID: "E" + string(rune('A'+id)), OccurredAt: at, ActorType: storytellerModel.AuditActorTypeUser,
		Source: storytellerModel.AuditSourceWeb, AuthMethod: storytellerModel.AuditAuthMethodSession, ProjectID: &project,
		Action: "story.update", Outcome: storytellerModel.AuditOutcomeSuccess, Summary: storytellerModel.AuditSummary{"version_id": float64(id)},
	}
}

func TestExportPendingAuditMonthsWritesLockedPartsAndSkipsCurrentMonth(t *testing.T) {
	now := time.Date(2026, 9, 27, 3, 0, 0, 0, time.UTC)
	repo := &fakeArchiveRepo{events: []storytellerModel.AuditEvent{
		archiveTestEvent(1, time.Date(2026, 7, 3, 1, 0, 0, 0, time.UTC)),
		archiveTestEvent(2, time.Date(2026, 7, 20, 1, 0, 0, 0, time.UTC)),
		archiveTestEvent(3, time.Date(2026, 9, 1, 1, 0, 0, 0, time.UTC)),
	}, exports: []storytellerModel.AuditExport{{Month: "2026-08", Status: storytellerModel.AuditExportStatusExported}}}
	store := &fakeArchiveStore{}
	months, err := exportPendingAuditMonths(context.Background(), repo, store, "audit", 7, now)
	require.NoError(t, err)
	require.Equal(t, []string{"2026-07"}, months, "八月已匯出、九月還沒結束，都不重做")

	key := "audit/year=2026/month=07/part-00000.jsonl.gz"
	require.Contains(t, store.objects, key)
	require.Equal(t, time.Date(2033, 8, 1, 0, 0, 0, 0, time.UTC), store.retain[key], "鎖定到月底 + 7 年")
	reader, err := gzip.NewReader(bytes.NewReader(store.objects[key]))
	require.NoError(t, err)
	raw, err := io.ReadAll(reader)
	require.NoError(t, err)
	lines := strings.Split(strings.TrimSpace(string(raw)), "\n")
	require.Len(t, lines, 2)
	var record auditArchiveRecord
	require.NoError(t, json.Unmarshal([]byte(lines[0]), &record))
	require.Equal(t, "2026-07-03T01:00:00.000000Z", record.OccurredAt)
	require.JSONEq(t, `{"version_id":1}`, record.Summary)

	require.Len(t, repo.saved, 1)
	require.Equal(t, storytellerModel.AuditExportStatusExported, repo.saved[0].Status)
	require.Equal(t, uint64(2), repo.saved[0].RowCount)
	require.True(t, repo.archived[1] && repo.archived[2] && !repo.archived[3], "只標記這次實際匯出的事件")
	require.NotNil(t, repo.saved[0].Checksum)
}

func TestExportPendingAuditMonthsSupplementsLateEvents(t *testing.T) {
	now := time.Date(2026, 9, 27, 3, 0, 0, 0, time.UTC)
	checksum := "base"
	retainUntil := time.Date(2033, 8, 1, 0, 0, 0, 0, time.UTC)
	repo := &fakeArchiveRepo{events: []storytellerModel.AuditEvent{
		archiveTestEvent(9, time.Date(2026, 7, 2, 1, 0, 0, 0, time.UTC)), // 已封存
		archiveTestEvent(5, time.Date(2026, 7, 3, 1, 0, 0, 0, time.UTC)), // 晚到而且 id 較小（晚 commit 的交易），仍要補匯
		archiveTestEvent(10, time.Date(2026, 8, 5, 1, 0, 0, 0, time.UTC)),
	}, archived: map[uint64]bool{9: true, 10: true}, exports: []storytellerModel.AuditExport{
		{Month: "2026-07", Status: storytellerModel.AuditExportStatusExported, RowCount: 5, Checksum: &checksum,
			RetainUntil: &retainUntil, ObjectKeys: storytellerModel.StringList{"audit/year=2026/month=07/part-00000.jsonl.gz"}},
		{Month: "2026-08", Status: storytellerModel.AuditExportStatusExported, RowCount: 1},
	}}
	store := &fakeArchiveStore{}
	months, err := exportPendingAuditMonths(context.Background(), repo, store, "audit", 7, now)
	require.NoError(t, err)
	require.Equal(t, []string{"2026-07"}, months, "八月沒有晚到事件，不重寫紀錄")
	require.Len(t, store.objects, 1)
	require.Contains(t, store.objects, "audit/year=2026/month=07/part-00001.jsonl.gz", "補匯接在既有檔案後面，不覆蓋")
	saved := repo.saved[0]
	require.Equal(t, uint64(6), saved.RowCount)
	require.Len(t, saved.ObjectKeys, 2)
	require.NotEqual(t, "base", *saved.Checksum)
	require.True(t, repo.archived[5])
}

func TestExportPendingAuditMonthsKeepsExportedRowWhenSupplementFails(t *testing.T) {
	repo := &fakeArchiveRepo{
		events:    []storytellerModel.AuditEvent{archiveTestEvent(9, time.Date(2026, 7, 2, 1, 0, 0, 0, time.UTC))},
		exports:   []storytellerModel.AuditExport{{Month: "2026-07", Status: storytellerModel.AuditExportStatusExported}},
		commitErr: errors.New("marked 0 of 1 events"),
	}
	_, err := exportPendingAuditMonths(context.Background(), repo, &fakeArchiveStore{}, "audit", 7, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))
	require.Error(t, err)
	require.Empty(t, repo.saved, "補匯失敗不能把已匯出的紀錄蓋成 failed")
}

func TestExportAuditMonthRecordsFailureWhenCommitFails(t *testing.T) {
	repo := &fakeArchiveRepo{events: []storytellerModel.AuditEvent{archiveTestEvent(1, time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC))}, commitErr: errors.New("marked 0 of 1 events")}
	months, err := exportPendingAuditMonths(context.Background(), repo, &fakeArchiveStore{}, "audit", 7, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))
	require.Error(t, err)
	require.Empty(t, months)
	require.Equal(t, storytellerModel.AuditExportStatusFailed, repo.saved[0].Status, "標記筆數對不上就不能標成已匯出")
}

func TestPurgeArchivedMySQLAuditMonthsOnlyDeletesExportedMonthsBeyondHotWindow(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	purgedAt := now.AddDate(0, 0, -3)
	repo := &fakeArchiveRepo{exports: []storytellerModel.AuditExport{
		{Month: "2026-04", Status: storytellerModel.AuditExportStatusExported, MySQLPurgedAt: &purgedAt}, // 清過、這次沒有新封存的列
		{Month: "2026-05", Status: storytellerModel.AuditExportStatusExported},
		{Month: "2026-06", Status: storytellerModel.AuditExportStatusExported}, // 月底 7/1 晚於 6/27，還在近期範圍
		{Month: "2026-03", Status: storytellerModel.AuditExportStatusFailed},
	}}
	purged, err := purgeArchivedMySQLAuditMonths(repo, now, 3)
	require.NoError(t, err)
	require.Equal(t, []string{"2026-05"}, purged)
	require.Equal(t, [][2]time.Time{
		{time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)},
		{time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)},
	}, repo.deletedRanges, "清過的月份每天照樣重刪一次，補匯進來的列才會清掉")
	require.Equal(t, []string{"2026-05 mysql_purged_at"}, repo.purgedColumns, "只單獨更新 mysql_purged_at")
	require.Empty(t, repo.saved, "清除排程不整列寫回匯出紀錄")
}

func TestPurgeExpiredArchiveMonthsRespectsLongerRetention(t *testing.T) {
	now := time.Date(2033, 9, 1, 0, 0, 0, 0, time.UTC)
	extended := time.Date(2035, 1, 1, 0, 0, 0, 0, time.UTC)
	repo := &fakeArchiveRepo{exports: []storytellerModel.AuditExport{
		{Month: "2026-06", Status: storytellerModel.AuditExportStatusExported},                         // 7/1 + 7 年 = 2033-07-01，已到期
		{Month: "2026-07", Status: storytellerModel.AuditExportStatusExported, RetainUntil: &extended}, // 手動延長過
		{Month: "2026-09", Status: storytellerModel.AuditExportStatusExported},                         // 2033-10-01 才到期
		{Month: "2026-05", Status: storytellerModel.AuditExportStatusExported},
	}}
	store := &fakeArchiveStore{failOn: "audit/year=2026/month=05/"}
	purged, err := purgeExpiredArchiveMonths(context.Background(), repo, store, "audit", 7, now)
	require.Error(t, err, "刪不掉的月份要回報，但不影響其他月份")
	require.Equal(t, []string{"2026-06"}, purged)
	require.Equal(t, []string{"audit/year=2026/month=06/"}, store.deleted)
	require.Equal(t, []string{"2026-06 archive_purged_at"}, repo.purgedColumns)
}

func TestValidateAuditArchiveMonths(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	purgedAt := now
	exports := []storytellerModel.AuditExport{
		{Month: "2026-04", Status: storytellerModel.AuditExportStatusExported},
		{Month: "2026-05", Status: storytellerModel.AuditExportStatusExported},
		{Month: "2026-06", Status: storytellerModel.AuditExportStatusExported},
		{Month: "2026-07", Status: storytellerModel.AuditExportStatusExported},
		{Month: "2019-01", Status: storytellerModel.AuditExportStatusExported, ArchivePurgedAt: &purgedAt},
	}
	months, err := validateAuditArchiveMonths("2026-04", "2026-06", exports, now, 3, 12)
	require.NoError(t, err)
	require.Len(t, months, 3)

	_, err = validateAuditArchiveMonths("2026-06", "2026-07", exports, now, 3, 12)
	require.ErrorIs(t, err, ErrAuditArchiveMonthUnavailable, "七月還在近期範圍內")
	_, err = validateAuditArchiveMonths("2019-01", "2019-01", exports, now, 3, 12)
	require.ErrorIs(t, err, ErrAuditArchiveMonthUnavailable, "已刪除的月份不能查")
	_, err = validateAuditArchiveMonths("2026-03", "2026-04", exports, now, 3, 12)
	require.ErrorIs(t, err, ErrAuditArchiveMonthUnavailable, "沒匯出的月份不能查")
	_, err = validateAuditArchiveMonths("2026-04", "2026-06", exports, now, 3, 2)
	require.ErrorIs(t, err, ErrAuditArchiveSpanTooLong)
	_, err = validateAuditArchiveMonths("2026-06", "2026-04", exports, now, 3, 12)
	require.ErrorIs(t, err, ErrAuditFilterInvalid)
}

func TestBuildAuditArchiveSQLParameterizesUserValues(t *testing.T) {
	months := []time.Time{time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)}
	projectID := uint64(9)
	sql, params := buildAuditArchiveSQL("audit_db", "events", 4, &projectID, months, nil, []string{"story.read"},
		storytellerModel.AuditArchiveFilters{Source: "mcp", CredentialRef: "pat_x'y"})
	require.Contains(t, sql, `FROM "audit_db"."events"`)
	require.Contains(t, sql, "((year = '2026' AND month = '05') OR (year = '2026' AND month = '06'))")
	require.Contains(t, sql, "action NOT IN ('story.read')")
	require.NotContains(t, sql, "pat_x", "使用者給的值不能出現在 SQL 字串裡")
	require.True(t, strings.HasPrefix(strings.Split(sql, "WHERE ")[1], "actor_user_id = ? AND project_id = ?"), "一定帶本人的 actor_user_id")
	require.Equal(t, []string{"4", "9", "'mcp'", "'pat_x''y'"}, params)
	require.Equal(t, strings.Count(sql, "?"), len(params))
}

func TestBuildAuditArchiveSQLStaysWithinAthenaParameterLimit(t *testing.T) {
	months := make([]time.Time, 0, 12)
	for index := range 12 {
		months = append(months, time.Date(2025, time.Month(index+1), 1, 0, 0, 0, 0, time.UTC))
	}
	_, exclude, err := auditFilterActions("", false)
	require.NoError(t, err)
	require.NotEmpty(t, exclude, "預設會排除全部低重要度 action")
	projectID := uint64(9)
	sql, params := buildAuditArchiveSQL("audit_db", "events", 4, &projectID, months, nil, exclude,
		storytellerModel.AuditArchiveFilters{Source: "mcp", Outcome: "success", CredentialRef: "pat_a"})
	require.Equal(t, strings.Count(sql, "?"), len(params))
	require.LessOrEqual(t, len(params), 25, "最多 12 個月加上所有篩選，也不能超過 Athena 的參數上限")
}

func TestCreateAuditArchiveQueryRecordsStartFailureWithoutLeakingError(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	repo := &fakeArchiveRepo{}
	exports := []storytellerModel.AuditExport{{Month: "2026-05", Status: storytellerModel.AuditExportStatusExported}}
	engine := &fakeQueryEngine{startErr: errors.New("AccessDenied: arn:aws:iam::123456789012")}
	output, err := createAuditArchiveQuery(context.Background(), repo, engine, exports, 4,
		storytellerModel.AuditArchiveQueryRequest{MonthFrom: "2026-05", MonthTo: "2026-05"}, "audit_db", "events", now)
	require.NoError(t, err)
	require.Equal(t, storytellerModel.AuditArchiveQueryFailed, output.Status)
	require.Equal(t, "query_start_failed", output.ErrorCategory)
	require.Contains(t, engine.sql, "action NOT IN", "未選類別時預設排除低重要度事件")
}

func TestRefreshAndReadAuditArchiveResults(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 5, 0, 0, time.UTC)
	executionID := "exec-1"
	row := &storytellerModel.AuditArchiveQuery{PublicID: "q1", UserID: 4, ExecutionID: &executionID, Status: storytellerModel.AuditArchiveQueryRunning, CreatedAt: now}
	repo := &fakeArchiveRepo{createdQueries: []*storytellerModel.AuditArchiveQuery{row}}
	values := []string{"E1", "2026-05-03T01:00:00.000000Z", "user", "4", "mcp", "pat", "pat_a", "1.2.3.4", "codex", "req", "9", "story.read", "story", "s1", "success", `{"count":3,"id":7}`}
	engine := &fakeQueryEngine{state: "SUCCEEDED",
		pages: map[string][][]string{"": {auditArchiveColumns, values}, "tok": {values}},
		next:  map[string]string{"": "tok"}}

	require.NoError(t, refreshAuditArchiveQuery(context.Background(), repo, engine, row, now))
	require.Equal(t, storytellerModel.AuditArchiveQuerySucceeded, row.Status)
	require.NotNil(t, row.CompletedAt)

	first, err := auditArchiveQueryResults(context.Background(), repo, engine, row, "")
	require.NoError(t, err)
	require.Len(t, first.Events, 1, "第一頁要去掉欄位名稱那一列")
	require.True(t, first.HasMore)
	require.Equal(t, "story.read", first.Events[0].Action)
	require.Equal(t, storytellerModel.AuditSummary{"count": float64(3)}, first.Events[0].Summary)

	second, err := auditArchiveQueryResults(context.Background(), repo, engine, row, first.NextCursor)
	require.NoError(t, err)
	require.Len(t, second.Events, 1)
	require.False(t, second.HasMore)

	require.Equal(t, now, *row.CompletedAt, "Athena 沒給完成時間時才用輪詢當下")

	row.CreatedAt = now.Add(-8 * 24 * time.Hour)
	require.NoError(t, applyAuditArchiveExpiry(repo, row, now))
	require.Equal(t, storytellerModel.AuditArchiveQuerySucceeded, row.Status, "保留期從完成時間算，不是建立時間")
	completedAt := now.Add(-8 * 24 * time.Hour)
	row.CompletedAt = &completedAt
	require.NoError(t, applyAuditArchiveExpiry(repo, row, now))
	_, err = auditArchiveQueryResults(context.Background(), repo, engine, row, "")
	require.ErrorIs(t, err, ErrAuditArchiveQueryExpired)
}

func TestAuditArchiveMonthsListsQueryableAndPurgedMonths(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	purgedAt := now
	output := auditArchiveMonths([]storytellerModel.AuditExport{
		{Month: "2019-03", Status: storytellerModel.AuditExportStatusExported, ArchivePurgedAt: &purgedAt},
		{Month: "2026-05", Status: storytellerModel.AuditExportStatusExported, RowCount: 12},
		{Month: "2026-06", Status: storytellerModel.AuditExportStatusExported},
		{Month: "2026-08", Status: storytellerModel.AuditExportStatusExported}, // 還在近期範圍，不列入
	}, now, 3, true)
	require.Equal(t, "2026-06", output.LatestMonth)
	require.Equal(t, []storytellerModel.AuditArchiveMonthOutput{
		{Month: "2026-06", Status: "available"},
		{Month: "2026-05", Status: "available"},
		{Month: "2019-03", Status: "purged"},
	}, output.Months)
}

func TestRefreshAuditArchiveQueryUsesAthenaCompletionTime(t *testing.T) {
	now := time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC)
	athenaDone := now.Add(-6 * 24 * time.Hour)
	executionID := "exec-1"
	row := &storytellerModel.AuditArchiveQuery{PublicID: "q1", UserID: 4, ExecutionID: &executionID, Status: storytellerModel.AuditArchiveQueryRunning, CreatedAt: athenaDone}
	engine := &fakeQueryEngine{state: "SUCCEEDED", completedAt: &athenaDone}
	require.NoError(t, refreshAuditArchiveQuery(context.Background(), &fakeArchiveRepo{}, engine, row, now))
	require.Equal(t, athenaDone, *row.CompletedAt, "六天後才輪詢，保留期仍從 Athena 完成時算起")
	require.NoError(t, applyAuditArchiveExpiry(&fakeArchiveRepo{}, row, now.Add(2*24*time.Hour)))
	require.Equal(t, storytellerModel.AuditArchiveQueryExpired, row.Status)
}

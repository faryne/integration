package storyteller

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const (
	auditArchivePollAfterMs    = 3000
	auditArchiveResultPageSize = 50
	// Athena 查詢結果 bucket 設定 7 天過期；過期後結果檔已不存在，job 標示 expired。
	auditArchiveResultTTL = 7 * 24 * time.Hour
	// 單次封存查詢最多回傳的筆數，避免一次查詢拖出無上限的結果頁。
	auditArchiveResultLimit    = 10000
	auditArchiveDefaultMaxSpan = 12
)

var (
	ErrAuditArchiveMonthUnavailable = errors.New("選擇的月份沒有可查詢的封存資料（可能還在近期範圍內、尚未匯出，或已超過保存期限）")
	ErrAuditArchiveSpanTooLong      = errors.New("封存查詢的月份範圍太長")
	ErrAuditArchiveQueryNotReady    = errors.New("封存查詢還沒完成，請稍後再試")
	ErrAuditArchiveQueryExpired     = errors.New("封存查詢結果已超過保留時間，請重新送出查詢")
)

// auditArchiveColumns 是 SELECT 的欄位順序，解析 Athena 結果列時依同一順序對回 AuditEvent。
var auditArchiveColumns = []string{
	"event_id", "occurred_at", "actor_type", "actor_user_id", "source", "auth_method", "credential_ref", "ip",
	"user_agent", "request_id", "project_id", "action", "target_type", "target_public_id", "outcome", "summary",
}

type auditArchiveQueryRepository interface {
	auditQueryRepository
	AuditExports() ([]storytellerModel.AuditExport, error)
	CreateAuditArchiveQuery(row *storytellerModel.AuditArchiveQuery) error
	AuditArchiveQueryByPublicID(userID uint64, publicID string) (*storytellerModel.AuditArchiveQuery, error)
	SaveAuditArchiveQuery(row *storytellerModel.AuditArchiveQuery) error
}

func auditArchiveMaxSpan() int {
	if months := config.EnvConfig().AuditArchiveMaxMonths; months > 0 {
		return months
	}
	return auditArchiveDefaultMaxSpan
}

// AuditArchiveMonths 列出可以封存查詢的月份（早於近期範圍且已匯出）與已依保存政策刪除的月份；
// 匯出是整站按月份做的，所以月份清單不分使用者，實際查詢時才限定本人的事件。
func (s *Service) AuditArchiveMonths() (*storytellerModel.AuditArchiveMonthsOutput, error) {
	exports, err := s.repo.AuditExports()
	if err != nil {
		return nil, err
	}
	return auditArchiveMonths(exports, time.Now(), auditHotMonths(), auditArchiveQueryEnabled()), nil
}

func auditArchiveMonths(exports []storytellerModel.AuditExport, now time.Time, hotMonths int, enabled bool) *storytellerModel.AuditArchiveMonthsOutput {
	output := &storytellerModel.AuditArchiveMonthsOutput{
		ArchiveAvailable: enabled, Months: make([]storytellerModel.AuditArchiveMonthOutput, 0),
		RetentionYears: auditArchiveRetentionYears(), MaxSpanMonths: auditArchiveMaxSpan(),
	}
	hotFrom := now.AddDate(0, -hotMonths, 0)
	for index := len(exports) - 1; index >= 0; index-- {
		row := exports[index]
		month, err := parseAuditMonth(row.Month)
		if err != nil || row.Status != storytellerModel.AuditExportStatusExported {
			continue
		}
		switch {
		case row.ArchivePurgedAt != nil:
			output.Months = append(output.Months, storytellerModel.AuditArchiveMonthOutput{Month: row.Month, Status: "purged"})
		case !month.After(hotFrom):
			output.Months = append(output.Months, storytellerModel.AuditArchiveMonthOutput{Month: row.Month, Status: "available", RowCount: row.RowCount})
			if output.LatestMonth == "" {
				output.LatestMonth = row.Month
			}
		}
	}
	return output
}

// CreateAuditArchiveQuery 驗證月份與篩選後建立 job 並送出 Athena 查詢；
// actor_user_id 條件由後端依登入者強制加入，前端不能查別人的事件或自訂 SQL。
func (s *Service) CreateAuditArchiveQuery(ctx context.Context, userID uint64, in storytellerModel.AuditArchiveQueryRequest) (*storytellerModel.AuditArchiveQueryOutput, error) {
	if !auditArchiveQueryEnabled() {
		return nil, ErrAuditArchiveUnavailable
	}
	exports, err := s.repo.AuditExports()
	if err != nil {
		return nil, err
	}
	engine, err := newAthenaAuditQueryEngine(ctx)
	if err != nil {
		return nil, err
	}
	env := config.EnvConfig()
	return createAuditArchiveQuery(ctx, s.repo, engine, exports, userID, in, env.AuditAthenaDatabase, env.AuditAthenaTable, time.Now())
}

func createAuditArchiveQuery(ctx context.Context, repo auditArchiveQueryRepository, engine auditArchiveQueryEngine, exports []storytellerModel.AuditExport, userID uint64, in storytellerModel.AuditArchiveQueryRequest, database, table string, now time.Time) (*storytellerModel.AuditArchiveQueryOutput, error) {
	months, err := validateAuditArchiveMonths(in.MonthFrom, in.MonthTo, exports, now, auditHotMonths(), auditArchiveMaxSpan())
	if err != nil {
		return nil, err
	}
	projectID, err := resolveAuditProjectFilter(repo, userID, in.Filters.ProjectPublicID)
	if err != nil {
		return nil, err
	}
	actions, exclude, err := auditFilterActions(in.Filters.Category, auditIncludeLowImportance(in.Filters.IncludeLowImportance, in.Filters.CredentialRef))
	if err != nil {
		return nil, err
	}
	if err := validateAuditFilterValues(in.Filters.Source, in.Filters.Outcome, in.Filters.CredentialRef); err != nil {
		return nil, err
	}
	sql, params := buildAuditArchiveSQL(database, table, userID, projectID, months, actions, exclude, in.Filters)
	row := &storytellerModel.AuditArchiveQuery{
		PublicID: randomID(), UserID: userID, Scope: storytellerModel.AuditEventScopeAccount, ProjectID: projectID,
		MonthFrom: in.MonthFrom, MonthTo: in.MonthTo, Filters: in.Filters, Status: storytellerModel.AuditArchiveQueryQueued,
	}
	if err := repo.CreateAuditArchiveQuery(row); err != nil {
		return nil, err
	}
	executionID, startErr := engine.StartQuery(ctx, sql, params)
	if startErr != nil {
		// 原始錯誤只寫 log；前端只拿到固定的錯誤分類，不回傳 Athena 的錯誤內容。
		log.Logger().Error("Start storyteller audit archive query failed", zap.String("query", row.PublicID), zap.Error(startErr))
		category := "query_start_failed"
		completedAt := now
		row.Status, row.ErrorCategory, row.CompletedAt = storytellerModel.AuditArchiveQueryFailed, &category, &completedAt
	} else {
		row.ExecutionID = &executionID
	}
	if err := repo.SaveAuditArchiveQuery(row); err != nil {
		return nil, err
	}
	return auditArchiveQueryOutput(row), nil
}

// validateAuditArchiveMonths 月份必須是「已匯出、未刪除、而且月初早於近期保存起點」，跨度不超過上限。
func validateAuditArchiveMonths(from, to string, exports []storytellerModel.AuditExport, now time.Time, hotMonths, maxSpan int) ([]time.Time, error) {
	start, err := parseAuditMonth(from)
	if err != nil {
		return nil, ErrAuditFilterInvalid
	}
	end, err := parseAuditMonth(to)
	if err != nil || end.Before(start) {
		return nil, ErrAuditFilterInvalid
	}
	available := make(map[string]bool, len(exports))
	for _, row := range exports {
		available[row.Month] = row.Status == storytellerModel.AuditExportStatusExported && row.ArchivePurgedAt == nil
	}
	hotFrom := now.AddDate(0, -hotMonths, 0)
	months := make([]time.Time, 0)
	for month := start; !month.After(end); month = month.AddDate(0, 1, 0) {
		if len(months) >= maxSpan {
			return nil, fmt.Errorf("%w：一次最多查詢 %d 個月", ErrAuditArchiveSpanTooLong, maxSpan)
		}
		if month.After(hotFrom) || !available[month.Format(auditArchiveMonthKey)] {
			return nil, ErrAuditArchiveMonthUnavailable
		}
		months = append(months, month)
	}
	return months, nil
}

// auditAthenaLiteral 把值轉成 Athena ExecutionParameters 需要的 SQL 字面值；Athena 會把參數原樣
// 代入 ?，所以字串要自己加引號並把單引號跳脫，讓值永遠只會是字串常數。
func auditAthenaLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}

func auditAthenaPlaceholders(values []string, params *[]string) string {
	placeholders := make([]string, len(values))
	for index, value := range values {
		placeholders[index] = "?"
		*params = append(*params, auditAthenaLiteral(value))
	}
	return strings.Join(placeholders, ", ")
}

// buildAuditArchiveSQL 組封存查詢 SQL；資料庫與資料表名稱來自設定並已驗證只含英數底線，
// 其餘所有值都走參數。一定帶本人的 actor_user_id；月份條件逐月列出 (year, month)，
// 讓 partition projection 只掃選到的月份。
func buildAuditArchiveSQL(database, table string, userID uint64, projectID *uint64, months []time.Time, actions, exclude []string, filters storytellerModel.AuditArchiveFilters) (string, []string) {
	params := []string{strconv.FormatUint(userID, 10)}
	where := []string{"actor_user_id = ?"}
	if projectID != nil {
		where = append(where, "project_id = ?")
		params = append(params, strconv.FormatUint(*projectID, 10))
	}
	monthConditions := make([]string, 0, len(months))
	for _, month := range months {
		monthConditions = append(monthConditions, "(year = ? AND month = ?)")
		params = append(params, auditAthenaLiteral(fmt.Sprintf("%04d", month.Year())), auditAthenaLiteral(fmt.Sprintf("%02d", int(month.Month()))))
	}
	where = append(where, "("+strings.Join(monthConditions, " OR ")+")")
	if len(actions) > 0 {
		where = append(where, "action IN ("+auditAthenaPlaceholders(actions, &params)+")")
	}
	if len(exclude) > 0 {
		where = append(where, "action NOT IN ("+auditAthenaPlaceholders(exclude, &params)+")")
	}
	for _, condition := range [][2]string{{"source", filters.Source}, {"outcome", filters.Outcome}, {"credential_ref", filters.CredentialRef}} {
		if condition[1] != "" {
			where = append(where, condition[0]+" = ?")
			params = append(params, auditAthenaLiteral(condition[1]))
		}
	}
	sql := fmt.Sprintf(`SELECT %s FROM "%s"."%s" WHERE %s ORDER BY occurred_at DESC, event_id DESC LIMIT %d`,
		strings.Join(auditArchiveColumns, ", "), database, table, strings.Join(where, " AND "), auditArchiveResultLimit)
	return sql, params
}

// AuditArchiveQueryStatus 輪詢時才向 Athena 查最新狀態，不需要另外的背景 worker。
func (s *Service) AuditArchiveQueryStatus(ctx context.Context, userID uint64, publicID string) (*storytellerModel.AuditArchiveQueryOutput, error) {
	row, err := s.repo.AuditArchiveQueryByPublicID(userID, publicID)
	if err != nil {
		return nil, err
	}
	if err := s.refreshAuditArchiveQuery(ctx, row); err != nil {
		return nil, err
	}
	return auditArchiveQueryOutput(row), nil
}

func (s *Service) refreshAuditArchiveQuery(ctx context.Context, row *storytellerModel.AuditArchiveQuery) error {
	if row.Status != storytellerModel.AuditArchiveQueryQueued && row.Status != storytellerModel.AuditArchiveQueryRunning {
		return applyAuditArchiveExpiry(s.repo, row, time.Now())
	}
	engine, err := newAthenaAuditQueryEngine(ctx)
	if err != nil {
		return err
	}
	return refreshAuditArchiveQuery(ctx, s.repo, engine, row, time.Now())
}

func refreshAuditArchiveQuery(ctx context.Context, repo auditArchiveQueryRepository, engine auditArchiveQueryEngine, row *storytellerModel.AuditArchiveQuery, now time.Time) error {
	if row.ExecutionID == nil || (row.Status != storytellerModel.AuditArchiveQueryQueued && row.Status != storytellerModel.AuditArchiveQueryRunning) {
		return applyAuditArchiveExpiry(repo, row, now)
	}
	state, scanned, err := engine.QueryStatus(ctx, *row.ExecutionID)
	if err != nil {
		return err
	}
	previous := row.Status
	switch state {
	case "QUEUED":
		row.Status = storytellerModel.AuditArchiveQueryQueued
	case "RUNNING":
		row.Status = storytellerModel.AuditArchiveQueryRunning
	case "SUCCEEDED":
		row.Status = storytellerModel.AuditArchiveQuerySucceeded
	default:
		// FAILED／CANCELLED 都算失敗；失敗原因只給固定分類（例如超過 workgroup 掃描上限），細節留在 AWS 端。
		category := "query_failed"
		row.Status, row.ErrorCategory = storytellerModel.AuditArchiveQueryFailed, &category
	}
	row.ScannedBytes = scanned
	if row.Status == storytellerModel.AuditArchiveQuerySucceeded || row.Status == storytellerModel.AuditArchiveQueryFailed {
		completedAt := now
		row.CompletedAt = &completedAt
	}
	if row.Status == previous && row.CompletedAt == nil {
		return nil
	}
	return repo.SaveAuditArchiveQuery(row)
}

func applyAuditArchiveExpiry(repo auditArchiveQueryRepository, row *storytellerModel.AuditArchiveQuery, now time.Time) error {
	if row.Status != storytellerModel.AuditArchiveQuerySucceeded || now.Sub(row.CreatedAt) < auditArchiveResultTTL {
		return nil
	}
	row.Status = storytellerModel.AuditArchiveQueryExpired
	return repo.SaveAuditArchiveQuery(row)
}

// AuditArchiveQueryResults 分頁讀取 Athena 結果並轉成與近期查詢相同的事件格式；
// 游標包的是 Athena 的 NextToken，但一定要搭配本人的 job 才用得到。
func (s *Service) AuditArchiveQueryResults(ctx context.Context, userID uint64, publicID, cursor string) (*storytellerModel.AuditArchiveResultsOutput, error) {
	row, err := s.repo.AuditArchiveQueryByPublicID(userID, publicID)
	if err != nil {
		return nil, err
	}
	if err := s.refreshAuditArchiveQuery(ctx, row); err != nil {
		return nil, err
	}
	engine, err := newAthenaAuditQueryEngine(ctx)
	if err != nil {
		return nil, err
	}
	return auditArchiveQueryResults(ctx, s.repo, engine, row, cursor)
}

func auditArchiveQueryResults(ctx context.Context, repo auditQueryRepository, engine auditArchiveQueryEngine, row *storytellerModel.AuditArchiveQuery, cursor string) (*storytellerModel.AuditArchiveResultsOutput, error) {
	switch row.Status {
	case storytellerModel.AuditArchiveQuerySucceeded:
	case storytellerModel.AuditArchiveQueryExpired:
		return nil, ErrAuditArchiveQueryExpired
	default:
		return nil, ErrAuditArchiveQueryNotReady
	}
	token := ""
	if cursor != "" {
		raw, err := base64.RawURLEncoding.DecodeString(cursor)
		if err != nil {
			return nil, ErrAuditCursorInvalid
		}
		token = string(raw)
	}
	rows, next, err := engine.QueryResults(ctx, *row.ExecutionID, token, auditArchiveResultPageSize)
	if err != nil {
		return nil, err
	}
	// Athena 第一頁的第一列是欄位名稱。
	if token == "" && len(rows) > 0 && slices.Equal(rows[0], auditArchiveColumns) {
		rows = rows[1:]
	}
	events := make([]storytellerModel.AuditEvent, 0, len(rows))
	for _, values := range rows {
		event, err := parseAuditArchiveRow(values)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	outputs, err := auditEventOutputs(repo, row.UserID, events)
	if err != nil {
		return nil, err
	}
	result := &storytellerModel.AuditArchiveResultsOutput{Events: outputs, HasMore: next != ""}
	if next != "" {
		result.NextCursor = base64.RawURLEncoding.EncodeToString([]byte(next))
	}
	return result, nil
}

func parseAuditArchiveRow(values []string) (storytellerModel.AuditEvent, error) {
	if len(values) != len(auditArchiveColumns) {
		return storytellerModel.AuditEvent{}, fmt.Errorf("unexpected audit archive column count %d", len(values))
	}
	get := func(column string) string { return values[slices.Index(auditArchiveColumns, column)] }
	optional := func(column string) *string {
		if value := get(column); value != "" {
			return &value
		}
		return nil
	}
	optionalID := func(column string) *uint64 {
		if value, err := strconv.ParseUint(get(column), 10, 64); err == nil {
			return &value
		}
		return nil
	}
	occurredAt, err := time.Parse(auditArchiveTimeLayout, get("occurred_at"))
	if err != nil {
		return storytellerModel.AuditEvent{}, err
	}
	event := storytellerModel.AuditEvent{
		EventID: get("event_id"), OccurredAt: occurredAt, ActorType: storytellerModel.AuditActorType(get("actor_type")),
		ActorUserID: optionalID("actor_user_id"), Source: storytellerModel.AuditSource(get("source")),
		AuthMethod: storytellerModel.AuditAuthMethod(get("auth_method")), CredentialRef: optional("credential_ref"),
		IP: optional("ip"), UserAgent: optional("user_agent"), RequestID: optional("request_id"), ProjectID: optionalID("project_id"),
		Action: get("action"), TargetType: optional("target_type"), TargetPublicID: optional("target_public_id"),
		Outcome: storytellerModel.AuditOutcome(get("outcome")),
	}
	if summary := get("summary"); summary != "" {
		if err := json.Unmarshal([]byte(summary), &event.Summary); err != nil {
			return storytellerModel.AuditEvent{}, err
		}
	}
	return event, nil
}

func auditArchiveQueryOutput(row *storytellerModel.AuditArchiveQuery) *storytellerModel.AuditArchiveQueryOutput {
	output := &storytellerModel.AuditArchiveQueryOutput{
		QueryPublicID: row.PublicID, Status: row.Status, MonthFrom: row.MonthFrom, MonthTo: row.MonthTo, Filters: row.Filters,
		ScannedBytes: row.ScannedBytes, PollAfterMs: auditArchivePollAfterMs, CreatedAt: row.CreatedAt, CompletedAt: row.CompletedAt,
	}
	if row.ErrorCategory != nil {
		output.ErrorCategory = *row.ErrorCategory
	}
	return output
}

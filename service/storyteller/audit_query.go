package storyteller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	auditEventDefaultLimit      = 50
	auditEventMaxLimit          = 100
	auditEventDefaultRange      = 24 * time.Hour
	auditEventDefaultHotMonths  = 3
	auditEventWriteDelaySeconds = 5
)

var (
	ErrAuditArchiveRequired = errors.New("查詢時間超過近期稽核的保存範圍，請改用封存查詢")
	ErrAuditFilterInvalid   = errors.New("稽核紀錄的篩選條件不正確")
	ErrAuditCursorInvalid   = errors.New("稽核紀錄的分頁位置不正確，請重新整理")
)

// PAT public_id 只會是英數、底線與連字號；先擋掉明顯不合法的值，避免無意義查詢。
var auditCredentialRefPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// 帳號層類別不會出現在專案稽核頁；system 事件沒有操作者，兩個頁面都不列入篩選。
var auditProjectHiddenCategories = []string{"auth", "credential", "profile", "system"}

// summary 可能帶有內部數字 ID（例如 provider key 的資料庫 id），對外一律拿掉。
var auditSummaryInternalKeys = []string{"id", "project_id", "user_id", "actor_user_id"}

type auditQueryRepository interface {
	AuditEvents(q storytellerModel.AuditEventQuery) ([]storytellerModel.AuditEvent, error)
	AuditUserDisplayNames(userIDs []uint64) (map[uint64]string, error)
	AuditCredentials(userID uint64, publicIDs []string) ([]storytellerModel.PersonalAccessToken, error)
	AuditTargetNames(userID uint64, refs []storytellerModel.AuditTargetRef) (map[storytellerModel.AuditTargetRef]string, error)
}

// ProjectAuditEvents 只給專案擁有者查近期稽核事件；ProjectByPublicIDForUser 本身就限定 owner。
func (s *Service) ProjectAuditEvents(userID uint64, projectPublicID string, params storytellerModel.AuditEventListParams) (*storytellerModel.AuditEventPageOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	base := storytellerModel.AuditEventQuery{Scope: storytellerModel.AuditEventScopeProject, ProjectID: project.ID, UserID: userID}
	return listAuditEvents(s.repo, base, params, time.Now(), auditHotMonths())
}

// AccountAuditEvents 固定查登入者本人，不接受前端指定其他使用者。
func (s *Service) AccountAuditEvents(userID uint64, params storytellerModel.AuditEventListParams) (*storytellerModel.AuditEventPageOutput, error) {
	base := storytellerModel.AuditEventQuery{Scope: storytellerModel.AuditEventScopeAccount, UserID: userID}
	return listAuditEvents(s.repo, base, params, time.Now(), auditHotMonths())
}

func (s *Service) ProjectAuditEventFilters(userID uint64, projectPublicID string) (*storytellerModel.AuditEventFiltersOutput, error) {
	if _, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return nil, err
	}
	return auditEventFilters(s.repo, userID, storytellerModel.AuditEventScopeProject)
}

func (s *Service) AccountAuditEventFilters(userID uint64) (*storytellerModel.AuditEventFiltersOutput, error) {
	return auditEventFilters(s.repo, userID, storytellerModel.AuditEventScopeAccount)
}

func auditHotMonths() int {
	if months := config.EnvConfig().AuditHotRetentionMonths; months > 0 {
		return months
	}
	return auditEventDefaultHotMonths
}

func listAuditEvents(repo auditQueryRepository, base storytellerModel.AuditEventQuery, params storytellerModel.AuditEventListParams, now time.Time, hotMonths int) (*storytellerModel.AuditEventPageOutput, error) {
	query, hotFrom, err := buildAuditEventQuery(base, params, now, hotMonths)
	if err != nil {
		return nil, err
	}
	rows, err := repo.AuditEvents(query)
	if err != nil {
		return nil, err
	}
	hasMore := len(rows) > query.Limit
	if hasMore {
		rows = rows[:query.Limit]
	}
	events, err := auditEventOutputs(repo, base.UserID, rows)
	if err != nil {
		return nil, err
	}
	page := &storytellerModel.AuditEventPageOutput{Events: events, HasMore: hasMore, HotFrom: hotFrom, WriteDelaySeconds: auditEventWriteDelaySeconds}
	if hasMore {
		last := rows[len(rows)-1]
		page.NextCursor = encodeAuditCursor(last.OccurredAt, last.ID)
	}
	return page, nil
}

// buildAuditEventQuery 把原始參數驗證成實際查詢條件；時間範圍一律夾在近期保存月數內，
// 超過就回 ErrAuditArchiveRequired，讓前端引導改用封存查詢，而不是默默截斷結果。
func buildAuditEventQuery(base storytellerModel.AuditEventQuery, p storytellerModel.AuditEventListParams, now time.Time, hotMonths int) (storytellerModel.AuditEventQuery, time.Time, error) {
	query := base
	hotFrom := now.AddDate(0, -hotMonths, 0)
	query.From, query.To = now.Add(-auditEventDefaultRange), now
	var err error
	if p.From != "" {
		if query.From, err = time.Parse(time.RFC3339, p.From); err != nil {
			return query, hotFrom, ErrAuditFilterInvalid
		}
	}
	if p.To != "" {
		if query.To, err = time.Parse(time.RFC3339, p.To); err != nil {
			return query, hotFrom, ErrAuditFilterInvalid
		}
	}
	if !query.From.Before(query.To) {
		return query, hotFrom, ErrAuditFilterInvalid
	}
	if query.From.Before(hotFrom) {
		return query, hotFrom, ErrAuditArchiveRequired
	}
	query.Limit = auditEventDefaultLimit
	if p.Limit > 0 {
		query.Limit = min(p.Limit, auditEventMaxLimit)
	}
	switch p.Actor {
	case "":
	case "self":
		query.ActorSelf = true
	case "system":
		query.ActorSystem = true
	default:
		return query, hotFrom, ErrAuditFilterInvalid
	}
	if query.Actions, query.ExcludeActions, err = auditFilterActions(p.Category, p.IncludeLowImportance); err != nil {
		return query, hotFrom, err
	}
	if err := validateAuditFilterValues(p.Source, p.Outcome, p.CredentialRef); err != nil {
		return query, hotFrom, err
	}
	query.Source, query.Outcome, query.CredentialRef = p.Source, p.Outcome, p.CredentialRef
	if p.Cursor != "" {
		cursorAt, cursorID, err := decodeAuditCursor(p.Cursor)
		if err != nil {
			return query, hotFrom, ErrAuditCursorInvalid
		}
		query.CursorAt, query.CursorID = &cursorAt, cursorID
	}
	return query, hotFrom, nil
}

// auditFilterActions 把類別篩選轉成 action 清單；近期查詢與封存查詢共用。使用者明確選了類別時
// 就照類別查，只有「全部」時才預設收起低重要度事件。
func auditFilterActions(category string, includeLowImportance bool) (actions, exclude []string, err error) {
	if category != "" {
		if actions = storytellerModel.AuditActionNames(category, ""); len(actions) == 0 {
			return nil, nil, ErrAuditFilterInvalid
		}
		return actions, nil, nil
	}
	if !includeLowImportance {
		exclude = storytellerModel.AuditActionNames("", storytellerModel.AuditImportanceLow)
	}
	return nil, exclude, nil
}

// validateAuditFilterValues 驗證入口、結果與 PAT 篩選值；近期查詢與封存查詢共用。
func validateAuditFilterValues(source, outcome, credentialRef string) error {
	if source != "" && !slices.Contains(auditSources(), storytellerModel.AuditSource(source)) {
		return ErrAuditFilterInvalid
	}
	if outcome != "" && !slices.Contains(auditOutcomes(), storytellerModel.AuditOutcome(outcome)) {
		return ErrAuditFilterInvalid
	}
	if credentialRef != "" && !auditCredentialRefPattern.MatchString(credentialRef) {
		return ErrAuditFilterInvalid
	}
	return nil
}

func auditSources() []storytellerModel.AuditSource {
	return []storytellerModel.AuditSource{storytellerModel.AuditSourceWeb, storytellerModel.AuditSourceMCP, storytellerModel.AuditSourceAPI, storytellerModel.AuditSourceCron}
}

func auditOutcomes() []storytellerModel.AuditOutcome {
	return []storytellerModel.AuditOutcome{storytellerModel.AuditOutcomeSuccess, storytellerModel.AuditOutcomeDenied, storytellerModel.AuditOutcomeFailed}
}

// 游標只編碼排序鍵 (occurred_at 微秒, id)，不含任何權限資訊；權限永遠由 scope 重新套用。
func encodeAuditCursor(at time.Time, id uint64) string {
	return base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf("%d.%d", at.UnixMicro(), id)))
}

func decodeAuditCursor(cursor string) (time.Time, uint64, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, 0, err
	}
	micros, id, ok := strings.Cut(string(raw), ".")
	if !ok {
		return time.Time{}, 0, errors.New("malformed audit cursor")
	}
	unixMicro, err := strconv.ParseInt(micros, 10, 64)
	if err != nil {
		return time.Time{}, 0, err
	}
	eventID, err := strconv.ParseUint(id, 10, 64)
	if err != nil {
		return time.Time{}, 0, err
	}
	return time.UnixMicro(unixMicro).UTC(), eventID, nil
}

// auditEventOutputs 批次補上操作者名稱、憑證名稱與目標名稱，每種資料只查一次。
func auditEventOutputs(repo auditQueryRepository, userID uint64, rows []storytellerModel.AuditEvent) ([]storytellerModel.AuditEventOutput, error) {
	actorIDs, credentialRefs, targetRefs := make([]uint64, 0), make([]string, 0), make([]storytellerModel.AuditTargetRef, 0)
	for _, row := range rows {
		if row.ActorUserID != nil && !slices.Contains(actorIDs, *row.ActorUserID) {
			actorIDs = append(actorIDs, *row.ActorUserID)
		}
		if row.CredentialRef != nil && !slices.Contains(credentialRefs, *row.CredentialRef) {
			credentialRefs = append(credentialRefs, *row.CredentialRef)
		}
		if row.TargetType != nil && row.TargetPublicID != nil {
			targetRefs = append(targetRefs, storytellerModel.AuditTargetRef{Type: *row.TargetType, PublicID: *row.TargetPublicID})
		}
	}
	actorNames, err := repo.AuditUserDisplayNames(actorIDs)
	if err != nil {
		return nil, err
	}
	credentialRows, err := repo.AuditCredentials(userID, credentialRefs)
	if err != nil {
		return nil, err
	}
	credentials := make(map[string]storytellerModel.PersonalAccessToken, len(credentialRows))
	for _, row := range credentialRows {
		credentials[row.PublicID] = row
	}
	targetNames, err := repo.AuditTargetNames(userID, targetRefs)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.AuditEventOutput, 0, len(rows))
	for _, row := range rows {
		outputs = append(outputs, auditEventOutput(row, actorNames, credentials, targetNames))
	}
	return outputs, nil
}

func auditEventOutput(row storytellerModel.AuditEvent, actorNames map[uint64]string, credentials map[string]storytellerModel.PersonalAccessToken, targetNames map[storytellerModel.AuditTargetRef]string) storytellerModel.AuditEventOutput {
	category, importance := "", storytellerModel.AuditImportanceNormal
	if action, ok := storytellerModel.AuditActionByName(row.Action); ok {
		category, importance = action.Category, action.Importance
	}
	output := storytellerModel.AuditEventOutput{
		EventID: row.EventID, OccurredAt: row.OccurredAt, Actor: storytellerModel.AuditActorOutput{Type: row.ActorType},
		Source: row.Source, AuthMethod: row.AuthMethod, Action: row.Action, Category: category, Importance: importance,
		Outcome: row.Outcome, Summary: publicAuditSummary(row.Summary),
		IP: stringValue(row.IP), UserAgent: stringValue(row.UserAgent), RequestID: stringValue(row.RequestID),
	}
	if row.ActorUserID != nil {
		output.Actor.DisplayName = actorNames[*row.ActorUserID]
	}
	if row.CredentialRef != nil {
		credential := storytellerModel.AuditCredentialOutput{PublicID: *row.CredentialRef, Label: "已撤銷的 PAT", Revoked: true}
		if token, ok := credentials[*row.CredentialRef]; ok {
			credential.Label, credential.Revoked = token.Label, token.IsDeleted
		}
		output.Credential = &credential
	}
	if row.TargetType != nil && row.TargetPublicID != nil {
		nameType := *row.TargetType
		if nameType == "volume" {
			nameType = "story"
		}
		output.Target = &storytellerModel.AuditTargetOutput{
			Type: *row.TargetType, PublicID: *row.TargetPublicID,
			Name: targetNames[storytellerModel.AuditTargetRef{Type: nameType, PublicID: *row.TargetPublicID}],
		}
	}
	return output
}

// publicAuditSummary 寫入時已經只存 allowlist 欄位；輸出前再拿掉內部數字 ID，雙重保險。
func publicAuditSummary(summary storytellerModel.AuditSummary) storytellerModel.AuditSummary {
	if len(summary) == 0 {
		return nil
	}
	output := make(storytellerModel.AuditSummary, len(summary))
	for key, value := range summary {
		if !slices.Contains(auditSummaryInternalKeys, key) {
			output[key] = value
		}
	}
	return output
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func auditEventFilters(repo auditQueryRepository, userID uint64, scope storytellerModel.AuditEventScope) (*storytellerModel.AuditEventFiltersOutput, error) {
	names, err := repo.AuditUserDisplayNames([]uint64{userID})
	if err != nil {
		return nil, err
	}
	actors := []storytellerModel.AuditFilterOption{{Value: "self", Label: names[userID]}}
	categories := make([]string, 0)
	for _, category := range storytellerModel.AuditCategories() {
		if category == "system" || scope == storytellerModel.AuditEventScopeProject && slices.Contains(auditProjectHiddenCategories, category) {
			continue
		}
		categories = append(categories, category)
	}
	tokens, err := repo.AuditCredentials(userID, nil)
	if err != nil {
		return nil, err
	}
	credentials := make([]storytellerModel.AuditFilterOption, 0, len(tokens))
	for _, token := range tokens {
		label := token.Label
		if token.IsDeleted {
			label += "（已撤銷）"
		}
		credentials = append(credentials, storytellerModel.AuditFilterOption{Value: token.PublicID, Label: label})
	}
	return &storytellerModel.AuditEventFiltersOutput{
		Actors: actors, Categories: categories, Credentials: credentials, Sources: auditSources(), Outcomes: auditOutcomes(),
	}, nil
}

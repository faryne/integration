package av

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	authService "faryne.dev/service/auth"
)

var (
	// ErrActressNoChanges 修改單的內容跟目前資料一樣
	ErrActressNoChanges = errors.New("沒有任何變更")
	// ErrActressTargetNotFound 修改單指定的女優不存在
	ErrActressTargetNotFound = errors.New("找不到要修改的女優")
	// ErrActressTargetAmbiguous 用姓名指定女優時有多位同名，要改用 domain-aid
	ErrActressTargetAmbiguous = errors.New("有多位同名女優，請改用 domain-aid 指定")
)

// 「xcity-123」「manual-45」這種寫法直接指定一位女優
var actressKeyPattern = regexp.MustCompile(`^(xcity|manual)-(\d+)$`)

// SubmitActress 建立一張待審核的提交單。present 不為 nil 時只採用這些欄位、其他沿用目前資料（MCP 修改只傳要改的欄位）
func SubmitActress(req avEntity.ActressSubmitRequest, present []string, channel string, userID uint64, ip string) (*avEntity.ActressSubmitResult, error) {
	repo := avRepo.NewDMMActress()
	sub := avEntity.DMMActressSubmission{Kind: req.Kind, Channel: channel, Status: avEntity.SubmissionStatusPending}
	result := &avEntity.ActressSubmitResult{Status: avEntity.SubmissionStatusPending, Duplicates: []avEntity.ActressCandidate{}}

	var payload avEntity.ActressFields
	switch req.Kind {
	case avEntity.SubmissionKindEdit:
		row, err := resolveActressTarget(repo, req)
		if err != nil {
			return nil, err
		}
		base := actressRowFields(*row)
		fields := req.Fields
		if present != nil {
			fields = applyActressFields(base, req.Fields, present)
		}
		if payload, err = normalizeActressFields(fields); err != nil {
			return nil, err
		}
		if result.ChangedFields = changedActressFields(base, payload); len(result.ChangedFields) == 0 {
			return nil, ErrActressNoChanges
		}
		raw, _ := json.Marshal(base)
		snapshot := string(raw)
		sub.TargetDomain, sub.TargetAID, sub.BaseSnapshot = row.Domain, row.ID, &snapshot
	case avEntity.SubmissionKindCreate:
		var err error
		if payload, err = normalizeActressFields(req.Fields); err != nil {
			return nil, err
		}
		result.ChangedFields = changedActressFields(avEntity.ActressFields{}, payload)
		if result.Duplicates, err = actressDuplicates(repo, payload); err != nil {
			return nil, err
		}
	default:
		return nil, invalidActress("kind 只能是 create 或 edit")
	}

	if err := acquireActressSubmit(ip); err != nil {
		return nil, err
	}
	raw, _ := json.Marshal(payload)
	now := time.Now()
	sub.Payload, sub.ChangedFields = string(raw), strings.Join(result.ChangedFields, ",")
	sub.SubmitterIPHash = hashIP(ip)
	sub.CreatedAt, sub.UpdatedAt = now, now
	if userID > 0 {
		sub.SubmitterUserID = &userID
	}
	if err := avRepo.NewDMMActressSubmission().Create(&sub); err != nil {
		return nil, err
	}
	result.ID = sub.ID
	return result, nil
}

// resolveActressTarget 修改單的目標：網頁傳 domain＋aid；MCP 傳「domain-aid」或姓名（同名多位時要求改用 domain-aid）
func resolveActressTarget(repo *avRepo.RepositoryDMMActress, req avEntity.ActressSubmitRequest) (*avEntity.DMMActress, error) {
	domain, aid := req.TargetDomain, req.TargetAID
	if target := strings.TrimSpace(req.Target); target != "" {
		if m := actressKeyPattern.FindStringSubmatch(target); m != nil {
			domain, aid = m[1], atoi(m[2])
		} else {
			rows, err := repo.FindByNames(actressSearchDomains, []string{target})
			if err != nil {
				return nil, err
			}
			switch len(rows) {
			case 0:
				return nil, ErrActressTargetNotFound
			case 1:
				return &rows[0], nil
			}
			keys := make([]string, 0, len(rows))
			for _, row := range rows {
				keys = append(keys, actressKey(row.Domain, row.ID))
			}
			return nil, fmt.Errorf("%w：%s", ErrActressTargetAmbiguous, strings.Join(keys, "、"))
		}
	}
	if aid <= 0 || (domain != actressDomainXCity && domain != avEntity.ActressDomainManual) {
		return nil, ErrActressTargetNotFound
	}
	row, err := repo.FindByKey(nil, domain, aid)
	if err != nil {
		return nil, ErrActressTargetNotFound
	}
	return row, nil
}

// actressDuplicates 姓名或假名相同的女優；ExactName 表示姓名完全相同（核准時要選合併或新增為另一位）
func actressDuplicates(repo *avRepo.RepositoryDMMActress, f avEntity.ActressFields) ([]avEntity.ActressCandidate, error) {
	rows, err := repo.FindDuplicates(actressSearchDomains, f.Name, f.Kana)
	if err != nil {
		return nil, err
	}
	out := make([]avEntity.ActressCandidate, 0, len(rows))
	for _, row := range rows {
		out = append(out, avEntity.ActressCandidate{Domain: row.Domain, AID: row.ID, ExactName: row.Name == f.Name, Fields: actressRowFields(row)})
	}
	return out, nil
}

// ActressSubmissionStatusByID 給提交者查詢結果（不含提交者資訊）
func ActressSubmissionStatusByID(id uint64) (*avEntity.ActressSubmissionStatus, error) {
	sub, err := avRepo.NewDMMActressSubmission().FindByID(id)
	if err != nil {
		return nil, err
	}
	status := &avEntity.ActressSubmissionStatus{
		ID: sub.ID, Kind: sub.Kind, Name: submissionPayload(*sub).Name, Status: sub.Status,
		Resolution: sub.Resolution, CreatedAt: sub.CreatedAt, ReviewedAt: sub.ReviewedAt,
	}
	// 否決原因只在否決狀態給提交者看；改為核准後保留在 DB 供管理者追查
	if sub.Status == avEntity.SubmissionStatusRejected {
		status.ReviewNote = sub.ReviewNote
	}
	return status, nil
}

// ListActressSubmissions 管理列表；未核准的單順便標出「提交後資料已變更」與「有同名女優」
func ListActressSubmissions(userID uint64, req avEntity.ActressSubmissionListRequest) ([]avEntity.ActressSubmissionSummary, int64, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, 0, err
	}
	page, perPage := max(req.Page, 1), req.PerPage
	if perPage <= 0 {
		perPage = 30
	}
	rows, total, err := avRepo.NewDMMActressSubmission().List(req.Status, page, perPage)
	if err != nil {
		return nil, 0, err
	}

	// 一次撈出相關的女優，避免逐列查詢
	var keys []avRepo.ActressKey
	var names []string
	for _, sub := range rows {
		switch {
		case sub.Status == avEntity.SubmissionStatusApproved:
		case sub.Kind == avEntity.SubmissionKindEdit:
			keys = append(keys, avRepo.ActressKey{Domain: sub.TargetDomain, ID: sub.TargetAID})
		default:
			names = append(names, submissionPayload(sub).Name)
		}
	}
	repo := avRepo.NewDMMActress()
	targets, err := repo.FindByKeys(keys)
	if err != nil {
		return nil, 0, err
	}
	sameNames := []avEntity.DMMActress{}
	if len(names) > 0 {
		if sameNames, err = repo.FindByNames(actressSearchDomains, names); err != nil {
			return nil, 0, err
		}
	}

	out := make([]avEntity.ActressSubmissionSummary, 0, len(rows))
	for _, sub := range rows {
		s := submissionSummary(sub)
		if sub.Status != avEntity.SubmissionStatusApproved {
			for _, t := range targets {
				if sub.Kind == avEntity.SubmissionKindEdit && t.Domain == sub.TargetDomain && t.ID == sub.TargetAID {
					s.Conflict = len(changedActressFields(submissionBase(sub), actressRowFields(t))) > 0
				}
			}
			for _, d := range sameNames {
				s.Duplicate = s.Duplicate || (sub.Kind == avEntity.SubmissionKindCreate && d.Name == s.Name)
			}
		}
		out = append(out, s)
	}
	return out, total, nil
}

// GetActressSubmission 審核頁：提交內容、提交當下與現在的資料、同名或同假名的女優
func GetActressSubmission(userID, id uint64) (*avEntity.ActressSubmissionDetail, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	sub, err := avRepo.NewDMMActressSubmission().FindByID(id)
	if err != nil {
		return nil, err
	}
	repo := avRepo.NewDMMActress()
	detail := &avEntity.ActressSubmissionDetail{ActressSubmissionSummary: submissionSummary(*sub), Payload: submissionPayload(*sub), Duplicates: []avEntity.ActressCandidate{}}
	if sub.Kind == avEntity.SubmissionKindEdit {
		base := submissionBase(*sub)
		detail.Base = &base
		if row, err := repo.FindByKey(nil, sub.TargetDomain, sub.TargetAID); err == nil {
			current := actressRowFields(*row)
			detail.Current = &current
			detail.Conflict = len(changedActressFields(base, current)) > 0
		}
		return detail, nil
	}
	if detail.Duplicates, err = actressDuplicates(repo, detail.Payload); err != nil {
		return nil, err
	}
	for _, d := range detail.Duplicates {
		detail.Duplicate = detail.Duplicate || d.ExactName
	}
	return detail, nil
}

func submissionSummary(sub avEntity.DMMActressSubmission) avEntity.ActressSubmissionSummary {
	changed := []string{}
	if sub.ChangedFields != "" {
		changed = strings.Split(sub.ChangedFields, ",")
	}
	return avEntity.ActressSubmissionSummary{
		DMMActressSubmission: sub,
		Name:                 submissionPayload(sub).Name,
		ChangedFields:        changed,
		IPHashPrefix:         sub.SubmitterIPHash[:min(4, len(sub.SubmitterIPHash))],
	}
}

func submissionPayload(sub avEntity.DMMActressSubmission) avEntity.ActressFields {
	return actressRowFields(avEntity.DMMActress{Info: sub.Payload})
}

func submissionBase(sub avEntity.DMMActressSubmission) avEntity.ActressFields {
	if sub.BaseSnapshot == nil {
		return actressRowFields(avEntity.DMMActress{Info: "{}"})
	}
	return actressRowFields(avEntity.DMMActress{Info: *sub.BaseSnapshot})
}

func hashIP(ip string) string {
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(sum[:])
}

func actressKey(domain string, aid int) string {
	return fmt.Sprintf("%s-%d", domain, aid)
}

func atoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

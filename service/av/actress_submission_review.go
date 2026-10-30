package av

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	authService "faryne.dev/service/auth"
	"gorm.io/gorm"
)

var (
	// ErrSubmissionNotReviewable 狀態不允許這個操作（已核准的不能再審、已否決的不能再否決）
	ErrSubmissionNotReviewable = errors.New("這張提交單目前不能進行這個操作")
	// ErrMergeTargetRequired 新增單有同名女優，核准時必須指定合併到哪一位或新增為另一位
	ErrMergeTargetRequired = errors.New("已有同名女優，請選擇要合併到哪一位，或新增為另一位")
)

const actressReviewNoteMaxLen = 500

// ApproveActressSubmission 核准（待審核或已否決的單都可以）。
//   - 修改單：只套用提交者改過的欄位，提交後被同步改過的其他欄位不會被蓋回去；xcity 女優同時記進覆寫
//   - 新增單：沒有同名女優、或 mergeTarget 是 new，就新增為 manual-{提交單 id}；否則合併到 mergeTarget 指定的那位
//
// 寫 DB、寫 ES（等 refresh）、改提交單都在同一個交易裡，ES 失敗就整筆回滾、維持原狀態
func ApproveActressSubmission(ctx context.Context, userID, id uint64, mergeTarget string) (*avEntity.DMMActressSubmission, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	if !actressWritesAllowed() {
		return nil, ErrActressWritesDisabled
	}
	subRepo, repo := avRepo.NewDMMActressSubmission(), avRepo.NewDMMActress()
	var approved *avEntity.DMMActressSubmission
	err := subRepo.Transaction(func(tx *gorm.DB) error {
		sub, err := subRepo.LockByID(tx, id)
		if err != nil {
			return err
		}
		if sub.Status != avEntity.SubmissionStatusPending && sub.Status != avEntity.SubmissionStatusRejected {
			return ErrSubmissionNotReviewable
		}
		row, resolution, err := approvedActressRow(tx, repo, *sub, mergeTarget)
		if err != nil {
			return err
		}
		now := time.Now()
		row.UpdatedAt = now
		if row.CreatedAt.IsZero() {
			row.CreatedAt = now
		}
		if err := repo.Save(tx, *row); err != nil {
			return err
		}
		doc := actressIndexDocument{Domain: row.Domain, AID: row.ID, ActressFields: actressRowFields(*row)}
		if err := putActressDocument(ctx, doc, "wait_for"); err != nil {
			return err
		}
		sub.Status, sub.Resolution, sub.MergedDomain, sub.MergedAID = avEntity.SubmissionStatusApproved, resolution, row.Domain, row.ID
		sub.ReviewerUserID, sub.ReviewedAt, sub.UpdatedAt = &userID, &now, now
		approved = sub
		return tx.Save(sub).Error
	})
	return approved, err
}

// approvedActressRow 依提交單算出核准後要寫入的女優資料與處理方式
func approvedActressRow(tx *gorm.DB, repo *avRepo.RepositoryDMMActress, sub avEntity.DMMActressSubmission, mergeTarget string) (*avEntity.DMMActress, string, error) {
	payload := submissionPayload(sub)
	if sub.Kind == avEntity.SubmissionKindEdit {
		row, err := repo.FindByKey(tx, sub.TargetDomain, sub.TargetAID)
		if err != nil {
			return nil, "", ErrActressTargetNotFound
		}
		keys := changedActressFields(submissionBase(sub), payload)
		return withActressChanges(row, applyActressFields(actressRowFields(*row), payload, keys), keys), avEntity.SubmissionResolutionUpdated, nil
	}

	sameNames, err := repo.FindByNames(actressSearchDomains, []string{payload.Name})
	if err != nil {
		return nil, "", err
	}
	if len(sameNames) == 0 || strings.TrimSpace(mergeTarget) == avEntity.ActressMergeTargetNew {
		info, _ := json.Marshal(payload)
		return &avEntity.DMMActress{ID: int(sub.ID), Domain: avEntity.ActressDomainManual, Name: payload.Name, Info: string(info)}, avEntity.SubmissionResolutionCreated, nil
	}
	for _, row := range sameNames {
		if actressKey(row.Domain, row.ID) == strings.TrimSpace(mergeTarget) {
			merged, keys := mergeActressFields(actressRowFields(row), payload)
			return withActressChanges(&row, merged, keys), avEntity.SubmissionResolutionMerged, nil
		}
	}
	return nil, "", ErrMergeTargetRequired
}

// withActressChanges 寫回新的資料；xcity 女優把改過的欄位記進覆寫，之後同步不會被洗掉
func withActressChanges(row *avEntity.DMMActress, fields avEntity.ActressFields, keys []string) *avEntity.DMMActress {
	info, _ := json.Marshal(fields)
	row.Name, row.Info = fields.Name, string(info)
	if row.Domain == actressDomainXCity {
		row.Overrides = encodeActressOverrides(addActressOverrides(decodeActressOverrides(row.Overrides), fields, keys))
	}
	return row
}

// RejectActressSubmission 否決待審核的單；原因會顯示給查詢這張單的人
func RejectActressSubmission(userID, id uint64, note string) (*avEntity.DMMActressSubmission, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	if note = strings.TrimSpace(note); utf8.RuneCountInString(note) > actressReviewNoteMaxLen {
		return nil, invalidActress("否決原因最多 %d 字", actressReviewNoteMaxLen)
	}
	subRepo := avRepo.NewDMMActressSubmission()
	var rejected *avEntity.DMMActressSubmission
	err := subRepo.Transaction(func(tx *gorm.DB) error {
		sub, err := subRepo.LockByID(tx, id)
		if err != nil {
			return err
		}
		if sub.Status != avEntity.SubmissionStatusPending {
			return ErrSubmissionNotReviewable
		}
		now := time.Now()
		sub.Status, sub.ReviewNote, sub.ReviewerUserID, sub.ReviewedAt, sub.UpdatedAt = avEntity.SubmissionStatusRejected, note, &userID, &now, now
		rejected = sub
		return tx.Save(sub).Error
	})
	return rejected, err
}

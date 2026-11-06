package av

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	authService "faryne.dev/service/auth"
	"gorm.io/gorm"
)

// ApproveVideoSubmission 核准影片修改（待審核或已否決的單都可以）：
// 只把提交者改過的欄位套到「目前的」ES 文件上，提交後被 DMM 同步改過的其他欄位不會被蓋回去；
// 改過的欄位同時記進 dmm_video_overrides，之後 DMM 同步也不會洗掉。
// 寫覆寫、寫 ES（等 refresh）、改提交單都在同一個交易裡，ES 失敗就整筆回滾、維持原狀態
func ApproveVideoSubmission(ctx context.Context, userID, id uint64) (*avEntity.DMMVideoSubmission, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	if !videoWritesAllowed() {
		return nil, ErrVideoWritesDisabled
	}
	subRepo, overrideRepo := avRepo.NewDMMVideoSubmission(), avRepo.NewDMMVideoOverride()
	var approved *avEntity.DMMVideoSubmission
	err := subRepo.Transaction(func(tx *gorm.DB) error {
		sub, err := subRepo.LockByID(tx, id)
		if err != nil {
			return err
		}
		if sub.Status != avEntity.SubmissionStatusPending && sub.Status != avEntity.SubmissionStatusRejected {
			return ErrSubmissionNotReviewable
		}
		srcs, err := avRepo.NewVideoIndex().Sources(ctx, []int{sub.TargetVid})
		if err != nil {
			return err
		}
		src, ok := srcs[sub.TargetVid]
		if !ok {
			return ErrVideoTargetNotFound
		}
		payload := videoSubmissionPayload(*sub)
		keys := changedVideoFields(videoSubmissionBase(*sub), payload)
		applyVideoValues(src, videoFieldMap(payload), keys)

		now := time.Now()
		override, err := overrideRepo.LockByVid(tx, sub.TargetVid)
		if err != nil {
			return err
		}
		override.Overrides, override.UpdatedAt = mergeVideoOverrides(override.Overrides, payload, keys), now
		if err := overrideRepo.Save(tx, override); err != nil {
			return err
		}
		if err := avRepo.NewVideoIndex().Index(ctx, sub.TargetVid, src, true); err != nil {
			return err
		}
		sub.Status, sub.ReviewerUserID, sub.ReviewedAt, sub.UpdatedAt = avEntity.SubmissionStatusApproved, &userID, &now, now
		approved = sub
		return tx.Save(sub).Error
	})
	return approved, err
}

// RejectVideoSubmission 否決待審核的單；原因會顯示給查詢這張單的人
func RejectVideoSubmission(userID, id uint64, note string) (*avEntity.DMMVideoSubmission, error) {
	if err := authService.RequireAdmin(userID); err != nil {
		return nil, err
	}
	if note = strings.TrimSpace(note); utf8.RuneCountInString(note) > actressReviewNoteMaxLen {
		return nil, invalidActress("否決原因最多 %d 字", actressReviewNoteMaxLen)
	}
	subRepo := avRepo.NewDMMVideoSubmission()
	var rejected *avEntity.DMMVideoSubmission
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

package storyteller

import storytellerModel "faryne.dev/model/entity/storyteller"

// 檢舉與處置理由。理由表很小，適用對象（applies_to）在 service 端過濾。

// ModerationReasons 回傳未停用的理由，依 sort_order。
func (r *Repository) ModerationReasons() ([]storytellerModel.ModerationReason, error) {
	rows := make([]storytellerModel.ModerationReason, 0)
	err := r.db.Where("is_deleted = 0").Order("sort_order ASC, id ASC").Find(&rows).Error
	return rows, err
}

func (r *Repository) ModerationReasonByKey(key string) (*storytellerModel.ModerationReason, error) {
	var row storytellerModel.ModerationReason
	err := r.db.Where("reason_key = ? AND is_deleted = 0", key).First(&row).Error
	return &row, err
}

func (r *Repository) CreateReport(row *storytellerModel.Report) error {
	return r.db.Create(row).Error
}

// HasPendingReport：同一人對同一目標還有待處理的檢舉時不重複建立。
func (r *Repository) HasPendingReport(reporterID uint64, targetType storytellerModel.ReportTargetType, targetID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&storytellerModel.Report{}).
		Where("reporter_user_id = ? AND target_type = ? AND target_id = ? AND status = ?", reporterID, targetType, targetID, storytellerModel.ReportStatusPending).
		Count(&count).Error
	return count > 0, err
}

// PublishedLore 是讀者看得到的一篇設定（已公開、未刪除），檢舉時確認目標存在用。
func (r *Repository) PublishedLore(projectID uint64, publicID string) (*storytellerModel.Lore, error) {
	var row storytellerModel.Lore
	err := r.db.Where("project_id = ? AND public_id = ? AND status = ? AND is_deleted = 0 AND deleted_at IS NULL",
		projectID, publicID, storytellerModel.StoryStatusCompleted).First(&row).Error
	return &row, err
}

package storyteller

import storytellerModel "faryne.dev/model/entity/storyteller"

// ProjectsByPublicIDs 依公開 id 批次取未刪除專案；搜尋卡片補封面用。
func (r *Repository) ProjectsByPublicIDs(publicIDs []string) ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0)
	if len(publicIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("public_id IN ? AND deleted_at IS NULL", publicIDs).
		Find(&rows).Error
	return rows, err
}

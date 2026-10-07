package storyteller

import storytellerModel "faryne.dev/model/entity/storyteller"

// ReaderLores 回傳閱讀頁要顯示的設定：一般讀者只拿已公開的，includeDrafts 給作者預覽自己未公開的專案用。
// 排序用建立時間而不是 updated_at：設定頁的上一則／下一則要穩定，不能作者一改字順序就跳。
func (r *Repository) ReaderLores(projectID uint64, includeDrafts bool) ([]storytellerModel.Lore, error) {
	rows := make([]storytellerModel.Lore, 0)
	query := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID)
	if !includeDrafts {
		query = query.Where("status = ?", storytellerModel.StoryStatusCompleted)
	}
	err := query.Order("created_at ASC, id ASC").Find(&rows).Error
	return rows, err
}

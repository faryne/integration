package storyteller

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
)

// LoreDependencies 批次撈多則設定的依賴，依 sort 排好；呼叫端自己依 lore_id 分組
func (r *Repository) LoreDependencies(loreIDs []uint64) ([]storytellerModel.LoreDependency, error) {
	rows := make([]storytellerModel.LoreDependency, 0)
	if len(loreIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("lore_id IN ?", loreIDs).Order("lore_id ASC, sort ASC, id ASC").Find(&rows).Error
	return rows, err
}

// ReplaceLoreDependencies 整批替換一則設定的依賴（先刪後寫，同一個交易），rows 為空就是清空
func (r *Repository) ReplaceLoreDependencies(loreID uint64, rows []storytellerModel.LoreDependency) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("lore_id = ?", loreID).Delete(&storytellerModel.LoreDependency{}).Error; err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.Create(&rows).Error
	})
}

// LoresByPublicIDs 依 public_id 批次撈同一個專案裡的設定（不分公開狀態），給設定連結驗證用
func (r *Repository) LoresByPublicIDs(projectID uint64, publicIDs []string) ([]storytellerModel.Lore, error) {
	rows := make([]storytellerModel.Lore, 0)
	if len(publicIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("project_id = ? AND public_id IN ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicIDs).
		Find(&rows).Error
	return rows, err
}

// ProjectTargetTitles 撈專案裡所有故事（不含冊）與設定的 id／public_id／標題，不分公開狀態；
// 只取這三個欄位，避免為了驗證依賴把每篇內文都讀出來
func (r *Repository) ProjectTargetTitles(projectID uint64) (stories []storytellerModel.Story, lores []storytellerModel.Lore, err error) {
	if err = r.db.Select("id", "public_id", "title").
		Where("project_id = ? AND is_volume = 0 AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Find(&stories).Error; err != nil {
		return nil, nil, err
	}
	err = r.db.Select("id", "public_id", "title").
		Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Find(&lores).Error
	return stories, lores, err
}

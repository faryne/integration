package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/plugin/dbresolver"
)

type RepositoryActressTopic struct {
	*repository.Repository[av.AVActressTopic]
}

func NewActressTopic() *RepositoryActressTopic {
	repo := repository.NewRepository[av.AVActressTopic](client.GetDB(enum.DBWalolita))
	return &RepositoryActressTopic{Repository: repo}
}

// live 未刪除的主題；管理頁寫完即讀、排程也要最新的定義，一律走 primary
func (r *RepositoryActressTopic) live() *gorm.DB {
	return r.GetDB().Clauses(dbresolver.Write).Model(&av.AVActressTopic{}).Where("is_deleted = 0")
}

// topicListOrder 分組順序跟總覽頁一致（特輯在前、身材在後），同分組內照 sort_order
const topicListOrder = "FIELD(group_key, 'special', 'body'), sort_order, id"

// List 管理列表：依分組、順序排好
func (r *RepositoryActressTopic) List() ([]av.AVActressTopic, error) {
	var rows []av.AVActressTopic
	err := r.live().Order(topicListOrder).Find(&rows).Error
	return rows, err
}

// ListEnabled 排程要產生的主題
func (r *RepositoryActressTopic) ListEnabled() ([]av.AVActressTopic, error) {
	var rows []av.AVActressTopic
	err := r.live().Where("is_enabled = 1").Order(topicListOrder).Find(&rows).Error
	return rows, err
}

func (r *RepositoryActressTopic) FindByID(id uint64) (*av.AVActressTopic, error) {
	var row av.AVActressTopic
	err := r.live().Where("id = ?", id).First(&row).Error
	return &row, err
}

// SlugTaken slug 已被其他未刪除的主題使用
func (r *RepositoryActressTopic) SlugTaken(slug string, exceptID uint64) (bool, error) {
	var n int64
	err := r.live().Where("slug = ? AND id <> ?", slug, exceptID).Count(&n).Error
	return n > 0, err
}

// NextSortOrder 新主題排在同分組最後
func (r *RepositoryActressTopic) NextSortOrder(group string) (int, error) {
	var maxOrder *int
	err := r.live().Where("group_key = ?", group).Select("MAX(sort_order)").Scan(&maxOrder).Error
	if err != nil || maxOrder == nil {
		return 1, err
	}
	return *maxOrder + 1, nil
}

// Save 修改基本資料與條件（不動排程回寫的欄位）
func (r *RepositoryActressTopic) Save(row *av.AVActressTopic) error {
	return r.GetDB().Model(row).Select("slug", "title", "group_key", "sort_order", "default_sort", "conditions", "updated_by", "updated_at").Updates(row).Error
}

func (r *RepositoryActressTopic) SetEnabled(id uint64, enabled bool, userID uint64) error {
	return r.live().Where("id = ?", id).Updates(map[string]any{"is_enabled": enabled, "updated_by": userID, "updated_at": time.Now()}).Error
}

// Reorder 依傳入的順序重編 sort_order（1 起算）
func (r *RepositoryActressTopic) Reorder(ids []uint64) error {
	return r.GetDB().Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := tx.Model(&av.AVActressTopic{}).Where("id = ? AND is_deleted = 0", id).Update("sort_order", i+1).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// SoftDelete 軟刪除；下一次排程就不會再產生
func (r *RepositoryActressTopic) SoftDelete(id uint64, userID uint64) error {
	now := time.Now()
	return r.live().Where("id = ?", id).Updates(map[string]any{"is_deleted": true, "deleted_at": now, "updated_by": userID, "updated_at": now}).Error
}

// SaveResults 排程回寫每個主題這次的人數與產生時間
func (r *RepositoryActressTopic) SaveResults(counts map[uint64]int, at time.Time) error {
	return r.GetDB().Transaction(func(tx *gorm.DB) error {
		for id, n := range counts {
			if err := tx.Model(&av.AVActressTopic{}).Where("id = ?", id).Updates(map[string]any{"last_count": n, "last_generated_at": at}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

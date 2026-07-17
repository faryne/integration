package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
)

type RepositoryETFFavorite struct {
	*repository.Repository[etf.Favorite]
}

func NewETFFavorite() *RepositoryETFFavorite {
	repo := repository.NewRepository[etf.Favorite](client.GetDB(enum.DBWalolita))
	return &RepositoryETFFavorite{
		Repository: repo,
	}
}

func (inst *RepositoryETFFavorite) ListByUser(userID uint64) ([]etf.Favorite, error) {
	var rows []etf.Favorite
	err := inst.GetDB().
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

// Find 不篩選 deleted_at，讓 service 層可以判斷是否要復活一筆軟刪除過的收藏，
// 而不是每次收藏/取消收藏都新增一列（會撞到 (user_id, code) 的 unique key）。
func (inst *RepositoryETFFavorite) Find(userID uint64, code string) (*etf.Favorite, error) {
	var row etf.Favorite
	err := inst.GetDB().
		Where("user_id = ? AND code = ?", userID, code).
		First(&row).Error
	return &row, err
}

// Save 是完整欄位覆蓋的 UPDATE（包含把 deleted_at 設回 NULL），
// 跟 base Repository.Update 的選擇性欄位更新不同，這裡需要能明確清掉 deleted_at。
func (inst *RepositoryETFFavorite) Save(row *etf.Favorite) error {
	return inst.GetDB().Save(row).Error
}

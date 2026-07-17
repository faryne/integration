package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
)

type RepositoryETFSavedTransaction struct {
	*repository.Repository[etf.SavedTransaction]
}

func NewETFSavedTransaction() *RepositoryETFSavedTransaction {
	repo := repository.NewRepository[etf.SavedTransaction](client.GetDB(enum.DBWalolita))
	return &RepositoryETFSavedTransaction{
		Repository: repo,
	}
}

// Find 不篩選 deleted_at，理由同 RepositoryETFFavorite.Find。
func (inst *RepositoryETFSavedTransaction) Find(userID uint64, code string) (*etf.SavedTransaction, error) {
	var row etf.SavedTransaction
	err := inst.GetDB().
		Where("user_id = ? AND code = ?", userID, code).
		First(&row).Error
	return &row, err
}

func (inst *RepositoryETFSavedTransaction) Save(row *etf.SavedTransaction) error {
	return inst.GetDB().Save(row).Error
}

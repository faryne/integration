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

// FindByUserAndCodes 一次查多個代號的已儲存交易紀錄，同樣不篩選 deleted_at，
// 由呼叫端自行判斷是否要當成「未儲存」處理。供「我的最愛」總覽頁批次彙整損益時使用。
func (inst *RepositoryETFSavedTransaction) FindByUserAndCodes(userID uint64, codes []string) ([]etf.SavedTransaction, error) {
	var rows = make([]etf.SavedTransaction, 0)
	if len(codes) == 0 {
		return rows, nil
	}
	err := inst.GetDB().
		Where("user_id = ? AND code IN ?", userID, codes).
		Find(&rows).Error
	return rows, err
}

func (inst *RepositoryETFSavedTransaction) Save(row *etf.SavedTransaction) error {
	return inst.GetDB().Save(row).Error
}

package etf

import (
	"time"

	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/repository"
	etfRepo "faryne.dev/repository/etf"
)

func ListFavorites(userID uint64) ([]etf.Favorite, error) {
	return etfRepo.NewETFFavorite().ListByUser(userID)
}

// AddFavorite 是冪等操作：已收藏過（含軟刪除過）就復活/維持現況，不會因為重複呼叫而新增多列。
func AddFavorite(userID uint64, code string) (*etf.Favorite, error) {
	repo := etfRepo.NewETFFavorite()
	row, err := repo.Find(userID, code)
	if err == nil {
		row.DeletedAt = nil
		if err := repo.Save(row); err != nil {
			return nil, err
		}
		return row, nil
	}
	if !repository.IsRecordNotFound(err) {
		return nil, err
	}
	newRow := &etf.Favorite{UserID: userID, Code: code}
	if err := repo.Create(newRow); err != nil {
		return nil, err
	}
	return newRow, nil
}

func RemoveFavorite(userID uint64, code string) error {
	repo := etfRepo.NewETFFavorite()
	row, err := repo.Find(userID, code)
	if err != nil {
		return nil // 本來就沒收藏，視為成功
	}
	now := time.Now()
	row.DeletedAt = &now
	return repo.Save(row)
}

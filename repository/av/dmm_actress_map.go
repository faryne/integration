package av

import (
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
)

type RepositoryDMMActressMap struct {
	*repository.Repository[av.DMMActressMap]
}

func NewDMMActressMap() *RepositoryDMMActressMap {
	repo := repository.NewRepository[av.DMMActressMap](client.GetDB(enum.DBWalolita))
	return &RepositoryDMMActressMap{Repository: repo}
}

// FindByDMMID 女優頁帶 ?dmm_id= 時，找出對到哪一位；大多數 DMM ID 不在表裡，用 Find 不用 First，避免每次都記一筆 record not found
func (r *RepositoryDMMActressMap) FindByDMMID(dmmID string) ([]av.DMMActressMap, error) {
	var rows []av.DMMActressMap
	err := r.GetDB().Where("dmm_id = ?", dmmID).Limit(1).Find(&rows).Error
	return rows, err
}

// FindByActresses 這些女優各自對到的 DMM ID（女優頁查出演影片時，一次撈本人與同名其他人）
func (r *RepositoryDMMActressMap) FindByActresses(keys []ActressKey) ([]av.DMMActressMap, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	pairs := make([][]any, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, []any{k.Domain, k.ID})
	}
	var rows []av.DMMActressMap
	err := r.GetDB().Where("(domain, aid) IN ?", pairs).Find(&rows).Error
	return rows, err
}

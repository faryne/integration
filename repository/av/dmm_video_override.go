package av

import (
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

type RepositoryDMMVideoOverride struct {
	*repository.Repository[av.DMMVideoOverride]
}

func NewDMMVideoOverride() *RepositoryDMMVideoOverride {
	return &RepositoryDMMVideoOverride{Repository: repository.NewRepository[av.DMMVideoOverride](client.GetDB(enum.DBWalolita))}
}

// ByVids 一批影片的手動覆寫（vid → 覆寫 JSON）；同步寫 ES 前用，剛核准完就會被讀，走 primary
func (r *RepositoryDMMVideoOverride) ByVids(vids []int) (map[int]string, error) {
	out := map[int]string{}
	if len(vids) == 0 {
		return out, nil
	}
	var rows []av.DMMVideoOverride
	if err := r.GetDB().Clauses(dbresolver.Write).Where("vid IN ?", vids).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.Vid] = row.Overrides
	}
	return out, nil
}

// LockByVid 核准時鎖住這部影片的覆寫（沒有就回傳空的），跟既有覆寫合併後再寫回
func (r *RepositoryDMMVideoOverride) LockByVid(tx *gorm.DB, vid int) (av.DMMVideoOverride, error) {
	var rows []av.DMMVideoOverride
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("vid = ?", vid).Limit(1).Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return av.DMMVideoOverride{Vid: vid, Overrides: "{}"}, err
	}
	return rows[0], nil
}

// Save 新增或覆蓋一部影片的覆寫
func (r *RepositoryDMMVideoOverride) Save(tx *gorm.DB, row av.DMMVideoOverride) error {
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "vid"}},
		DoUpdates: clause.AssignmentColumns([]string{"overrides", "updated_at"}),
	}).Create(&row).Error
}

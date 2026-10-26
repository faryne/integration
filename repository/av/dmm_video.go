package av

import (
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryDMMVideo struct {
	*repository.Repository[av.DMMVideo]
}

func NewDMMVideo() *RepositoryDMMVideo {
	return &RepositoryDMMVideo{Repository: repository.NewRepository[av.DMMVideo](client.GetDB(enum.DBWalolita))}
}

// UpsertBatch 以 no 為唯一鍵批次寫入；既有作品只更新內容，id 不變（ES document id 才會穩定）
func (r *RepositoryDMMVideo) UpsertBatch(videos []av.DMMVideo) error {
	return r.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "no"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "link", "thumb", "info", "updated_at"}),
	}).Create(&videos).Error
}

// IDsByNos 回傳 no → id；ON DUPLICATE KEY UPDATE 拿不到既有列的 id，寫完要另外查
func (r *RepositoryDMMVideo) IDsByNos(nos []string) (map[string]int, error) {
	var rows []av.DMMVideo
	if err := r.GetDB().Select("id", "no").Where("no IN ?", nos).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, row := range rows {
		out[row.No] = row.ID
	}
	return out, nil
}

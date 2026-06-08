package av

import (
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryDMMActress struct {
	*repository.Repository[av.DMMActress]
}

func NewDMMActress() *RepositoryDMMActress {
	repo := repository.NewRepository[av.DMMActress](client.GetDB(enum.DBWalolita))
	return &RepositoryDMMActress{Repository: repo}
}

func (r *RepositoryDMMActress) Upsert(actress av.DMMActress) error {
	return r.GetDB().Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "domain"}, {Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "info", "updated_at",
		}),
	}).Create(&actress).Error
}

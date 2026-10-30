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

type RepositoryDMMActressSubmission struct {
	*repository.Repository[av.DMMActressSubmission]
}

func NewDMMActressSubmission() *RepositoryDMMActressSubmission {
	repo := repository.NewRepository[av.DMMActressSubmission](client.GetDB(enum.DBWalolita))
	return &RepositoryDMMActressSubmission{Repository: repo}
}

// FindByID 讀一張提交單；審核是寫完即讀，走 primary
func (r *RepositoryDMMActressSubmission) FindByID(id uint64) (*av.DMMActressSubmission, error) {
	var row av.DMMActressSubmission
	err := r.GetDB().Clauses(dbresolver.Write).First(&row, id).Error
	return &row, err
}

// LockByID 核准／否決時鎖住提交單，避免同一張被重複處理
func (r *RepositoryDMMActressSubmission) LockByID(tx *gorm.DB, id uint64) (*av.DMMActressSubmission, error) {
	var row av.DMMActressSubmission
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, id).Error
	return &row, err
}

// List 管理列表，依狀態篩選、新的在前
func (r *RepositoryDMMActressSubmission) List(status string, page, perPage int64) ([]av.DMMActressSubmission, int64, error) {
	q := r.GetDB().Clauses(dbresolver.Write).Model(&av.DMMActressSubmission{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []av.DMMActressSubmission
	err := q.Order("id DESC").Offset(int((page - 1) * perPage)).Limit(int(perPage)).Find(&rows).Error
	return rows, total, err
}

// Transaction 核准時「寫女優＋改提交單」包在同一個交易
func (r *RepositoryDMMActressSubmission) Transaction(fn func(tx *gorm.DB) error) error {
	return r.GetDB().Clauses(dbresolver.Write).Transaction(fn)
}

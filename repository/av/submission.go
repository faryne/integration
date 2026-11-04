package av

import (
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// RepositorySubmission 上稿提交單（女優 dmm_actress_submissions、影片 dmm_video_submissions）共用的存取：
// 兩張表的狀態欄位與審核流程一樣，只有內容欄位不同
type RepositorySubmission[T any] struct {
	*repository.Repository[T]
}

func newSubmission[T any]() *RepositorySubmission[T] {
	return &RepositorySubmission[T]{Repository: repository.NewRepository[T](client.GetDB(enum.DBWalolita))}
}

// FindByID 讀一張提交單；審核是寫完即讀，走 primary
func (r *RepositorySubmission[T]) FindByID(id uint64) (*T, error) {
	var row T
	err := r.GetDB().Clauses(dbresolver.Write).First(&row, id).Error
	return &row, err
}

// LockByID 核准／否決時鎖住提交單，避免同一張被重複處理
func (r *RepositorySubmission[T]) LockByID(tx *gorm.DB, id uint64) (*T, error) {
	var row T
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, id).Error
	return &row, err
}

// List 管理列表，依狀態篩選、新的在前
func (r *RepositorySubmission[T]) List(status string, page, perPage int64) ([]T, int64, error) {
	q := r.GetDB().Clauses(dbresolver.Write).Model(new(T))
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []T
	err := q.Order("id DESC").Offset(int((page - 1) * perPage)).Limit(int(perPage)).Find(&rows).Error
	return rows, total, err
}

// Transaction 核准時「寫資料＋改提交單」包在同一個交易
func (r *RepositorySubmission[T]) Transaction(fn func(tx *gorm.DB) error) error {
	return r.GetDB().Clauses(dbresolver.Write).Transaction(fn)
}

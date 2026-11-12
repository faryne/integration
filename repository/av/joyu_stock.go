package av

import (
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"

	"gorm.io/plugin/dbresolver"
)

// joyu.fyi 女優股市的上市股。公開頁面讀 replica；上市審核是排程寫完即比對，一律走 primary

type RepositoryJoyuStock struct {
	*repository.Repository[av.JoyuStock]
}

func NewJoyuStock() *RepositoryJoyuStock {
	return &RepositoryJoyuStock{Repository: repository.NewRepository[av.JoyuStock](client.GetDB(enum.DBWalolita))}
}

// ListListed 上市中的全部（股市總覽，約 500 檔，不分頁），依代碼排
func (r *RepositoryJoyuStock) ListListed() ([]av.JoyuStock, error) {
	var rows []av.JoyuStock
	err := r.GetDB().Where("status = ?", av.StockListed).Order("id").Find(&rows).Error
	return rows, err
}

// ListListedPrimary 上市中的全部（基本面重算用，讀 primary）
func (r *RepositoryJoyuStock) ListListedPrimary() ([]av.JoyuStock, error) {
	var rows []av.JoyuStock
	err := r.GetDB().Clauses(dbresolver.Write).Where("status = ?", av.StockListed).Order("id").Find(&rows).Error
	return rows, err
}

// FindByID 個股頁、報價；讀 primary，自己剛下單完重新整理要看到新價格。找不到回 gorm.ErrRecordNotFound（controller 轉 404）
func (r *RepositoryJoyuStock) FindByID(id int) (*av.JoyuStock, error) {
	var row av.JoyuStock
	if err := r.GetDB().Clauses(dbresolver.Write).First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// FindByIDs 我的持股、成交紀錄要顯示的那幾檔（讀 primary，價格要是剛成交後的）
func (r *RepositoryJoyuStock) FindByIDs(ids []int) ([]av.JoyuStock, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var rows []av.JoyuStock
	err := r.GetDB().Clauses(dbresolver.Write).Where("id IN ?", ids).Order("id").Find(&rows).Error
	return rows, err
}

// ListAllForReview 上市審核用：含已下市的（不能重複上市同一位），讀 primary
func (r *RepositoryJoyuStock) ListAllForReview() ([]av.JoyuStock, error) {
	var rows []av.JoyuStock
	err := r.GetDB().Clauses(dbresolver.Write).Find(&rows).Error
	return rows, err
}

// CreateBatch 新上市的一批
func (r *RepositoryJoyuStock) CreateBatch(rows []av.JoyuStock) error {
	if len(rows) == 0 {
		return nil
	}
	return r.GetDB().CreateInBatches(rows, 200).Error
}

// UpdateReview 上市審核時更新名字快照與近 90 天部數
func (r *RepositoryJoyuStock) UpdateReview(id int, name string, videos90d int) error {
	return r.GetDB().Model(&av.JoyuStock{}).Where("id = ?", id).
		Updates(map[string]any{"name": name, "videos_90d": videos90d}).Error
}

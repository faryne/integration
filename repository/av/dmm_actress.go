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

// ActressKey 用 domain＋id 指定一位女優
type ActressKey struct {
	Domain string
	ID     int
}

// FindByKey 讀一位女優；上稿核准是寫完即讀，一律走 primary
func (r *RepositoryDMMActress) FindByKey(tx *gorm.DB, domain string, id int) (*av.DMMActress, error) {
	var row av.DMMActress
	err := r.db(tx).Clauses(dbresolver.Write).Where("domain = ? AND id = ?", domain, id).First(&row).Error
	return &row, err
}

// FindByKeys 一次讀多位女優（管理列表判斷「提交後資料已變更」用）
func (r *RepositoryDMMActress) FindByKeys(keys []ActressKey) ([]av.DMMActress, error) {
	if len(keys) == 0 {
		return nil, nil
	}
	pairs := make([][]any, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, []any{k.Domain, k.ID})
	}
	var rows []av.DMMActress
	err := r.GetDB().Where("(domain, id) IN ?", pairs).Find(&rows).Error
	return rows, err
}

// FindByNames 姓名完全相同的女優（只看 xcity 與手動上稿）
func (r *RepositoryDMMActress) FindByNames(domains []string, names []string) ([]av.DMMActress, error) {
	var rows []av.DMMActress
	err := r.GetDB().Clauses(dbresolver.Write).Where("domain IN ? AND name IN ?", domains, names).Order("domain, id").Find(&rows).Error
	return rows, err
}

// FindByDomains 指定 domain 的全部女優（女優主題排程用，約 1.6 萬筆）；排程一律走 primary
func (r *RepositoryDMMActress) FindByDomains(domains []string) ([]av.DMMActress, error) {
	var rows []av.DMMActress
	err := r.GetDB().Clauses(dbresolver.Write).Where("domain IN ?", domains).Order("domain, id").Find(&rows).Error
	return rows, err
}

// FindDuplicates 姓名或假名相同的女優；假名存在 info JSON 裡，筆數不多直接用 JSON_EXTRACT 掃
func (r *RepositoryDMMActress) FindDuplicates(domains []string, name, kana string) ([]av.DMMActress, error) {
	q := r.GetDB().Clauses(dbresolver.Write).Where("domain IN ?", domains)
	if kana != "" {
		q = q.Where("(name = ? OR JSON_UNQUOTE(JSON_EXTRACT(info, '$.kana')) = ?)", name, kana)
	} else {
		q = q.Where("name = ?", name)
	}
	var rows []av.DMMActress
	err := q.Order("domain, id").Limit(10).Find(&rows).Error
	return rows, err
}

// OverridesByDomain 某個 domain 所有手動覆寫（xcity 同步開始前一次載入）
func (r *RepositoryDMMActress) OverridesByDomain(domain string) (map[int]string, error) {
	var rows []av.DMMActress
	if err := r.GetDB().Select("id, overrides").Where("domain = ? AND overrides IS NOT NULL", domain).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[int]string, len(rows))
	for _, row := range rows {
		out[row.ID] = *row.Overrides
	}
	return out, nil
}

// Save 上稿核准寫入一位女優（新增或整筆更新 name／info／overrides）
func (r *RepositoryDMMActress) Save(tx *gorm.DB, actress av.DMMActress) error {
	return r.db(tx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "domain"}, {Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "info", "overrides", "updated_at"}),
	}).Create(&actress).Error
}

func (r *RepositoryDMMActress) db(tx *gorm.DB) *gorm.DB {
	if tx != nil {
		return tx
	}
	return r.GetDB()
}

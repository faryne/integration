package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
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
		Columns: []clause.Column{{Name: "no"}},
		// is_orphan／orphaned_at 一併覆寫成新值（false／NULL）：DMM 重新抓得到就不再是 orphan
		DoUpdates: clause.AssignmentColumns([]string{"title", "link", "thumb", "info", "is_orphan", "orphaned_at", "updated_at"}),
	}).Create(&videos).Error
}

// MarkOrphan 把同步確定失敗的作品標成 orphan
func (r *RepositoryDMMVideo) MarkOrphan(ids []int) error {
	if len(ids) == 0 {
		return nil
	}
	return r.GetDB().Model(&av.DMMVideo{}).Where("id IN ?", ids).
		Updates(map[string]any{"is_orphan": true, "orphaned_at": time.Now()}).Error
}

// IDsByNos 回傳 no → id；ON DUPLICATE KEY UPDATE 拿不到既有列的 id，寫完要另外查。
// 強制走 primary：剛 INSERT 的新作品 replica 可能還沒同步到，讀 replica 會查不到 id
func (r *RepositoryDMMVideo) IDsByNos(nos []string) (map[string]int, error) {
	var rows []av.DMMVideo
	if err := r.GetDB().Clauses(dbresolver.Write).Select("id", "no").Where("no IN ?", nos).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, row := range rows {
		out[row.No] = row.ID
	}
	return out, nil
}

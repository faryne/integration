package nekomaid

import (
	"strings"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
)

// ForbiddenRepository 禁抓名單（artwork_forbidden）與同步 job 會用到的 artwork_main 查詢
type ForbiddenRepository struct {
	*repository.Repository[nekomaid.ArtworkForbidden]
}

func NewForbiddenRepository() *ForbiddenRepository {
	return &ForbiddenRepository{Repository: repository.NewRepository[nekomaid.ArtworkForbidden](client.GetDB(enum.DBNekomaid))}
}

// live 尚未解除的禁抓
func (r *ForbiddenRepository) live() *gorm.DB {
	return r.GetDB().Model(&nekomaid.ArtworkForbidden{}).Where("artwork_forbidden.is_deleted = 0")
}

// IsForbidden 整個畫師被禁（artwork_id = ”）或這件作品被禁都算；artworkId 給空字串時只看畫師層級
func (r *ForbiddenRepository) IsForbidden(site enum.NekomaidSite, authorId, artworkId string) (bool, error) {
	var count int64
	err := r.live().
		Where("site = ? AND author_id = ? AND artwork_id IN ?", site, authorId, []string{"", artworkId}).
		Count(&count).Error
	return count > 0, err
}

// Search 後台列表，附上 artwork_authors 的暱稱；新增的排前面
func (r *ForbiddenRepository) Search(input nekomaid.ForbiddenSearchRequest) ([]nekomaid.ForbiddenAdminItem, int64, error) {
	query := r.live().Joins("LEFT JOIN artwork_authors aa ON aa.site = artwork_forbidden.site AND aa.author_id = artwork_forbidden.author_id")
	if site := strings.TrimSpace(input.Site); site != "" {
		query = query.Where("artwork_forbidden.site = ?", site)
	}
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("artwork_forbidden.author_id = ? OR artwork_forbidden.artwork_id = ? OR aa.nickname LIKE ?", keyword, keyword, like)
	}
	switch input.Status {
	case "pending":
		query = query.Where("artwork_forbidden.is_proceed = 0")
	case "done":
		query = query.Where("artwork_forbidden.is_proceed = 1")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]nekomaid.ForbiddenAdminItem, 0)
	err := query.Select("artwork_forbidden.*, COALESCE(aa.nickname, '') AS nickname").
		Order("artwork_forbidden.id DESC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&rows).Error
	return rows, total, err
}

// FindTarget 依目標找一列（含已解除的），用來判斷重複新增或復原
func (r *ForbiddenRepository) FindTarget(site enum.NekomaidSite, authorId, artworkId string) (*nekomaid.ArtworkForbidden, error) {
	var row nekomaid.ArtworkForbidden
	err := r.GetDB().Where("site = ? AND author_id = ? AND artwork_id = ?", site, authorId, artworkId).First(&row).Error
	return &row, err
}

// Save 新增或整列更新（復原已解除的禁抓也走這裡）
func (r *ForbiddenRepository) Save(row *nekomaid.ArtworkForbidden) error {
	return r.GetDB().Save(row).Error
}

// SoftDelete 解除禁抓；is_proceed 歸零，交給同步 job 把作品重新索引回 ES
func (r *ForbiddenRepository) SoftDelete(id uint64) error {
	now := time.Now()
	result := r.live().Where("id = ?", id).
		Updates(map[string]any{"is_deleted": 1, "deleted_at": now, "is_proceed": 0, "finish_time": nil, "updated_at": now})
	if result.Error == nil && result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

// Pending 同步 job 待處理的禁抓（含剛解除、要回補 ES 的），依最後異動時間先後處理
func (r *ForbiddenRepository) Pending(limit int) ([]nekomaid.ArtworkForbidden, error) {
	var rows []nekomaid.ArtworkForbidden
	err := r.GetDB().Where("is_proceed = 0").Order("updated_at, id").Limit(limit).Find(&rows).Error
	return rows, err
}

// MarkProceed 同步 job 處理完成（ES 已跟這列目前的狀態一致）
// 以 updated_at 比對 job 讀到的那一版：處理期間管理者剛好解除／重新禁抓時，不會把新狀態誤標成已處理
func (r *ForbiddenRepository) MarkProceed(row nekomaid.ArtworkForbidden) error {
	now := time.Now()
	return r.GetDB().Model(&nekomaid.ArtworkForbidden{}).Where("id = ? AND updated_at = ?", row.Id, row.UpdatedAt).
		Updates(map[string]any{"is_proceed": 1, "finish_time": now, "updated_at": now}).Error
}

// AuthorOfArtwork 只給作品 ID 時反查畫師
func (r *ForbiddenRepository) AuthorOfArtwork(site enum.NekomaidSite, artworkId string) (string, error) {
	var authorId string
	err := r.GetDB().Table("artwork_main").Select("author_id").
		Where("site = ? AND artwork_id = ?", site, artworkId).Limit(1).Scan(&authorId).Error
	if err == nil && authorId == "" {
		return "", gorm.ErrRecordNotFound
	}
	return authorId, err
}

// RestorableArtworks 解除禁抓時要重新索引的作品：目標底下 artwork_main 未刪除（is_deleted = -1）的列；
// artworkId 空字串時取整個畫師。is_deleted／is_animated 在 DB 是 -1/0/1 的 tinyint，直接掃進 bool 會失敗，
// 所以不選 is_deleted、其餘旗標先在 SQL 轉成 0/1。
func (r *ForbiddenRepository) RestorableArtworks(target nekomaid.ArtworkForbidden) ([]nekomaid.ArtworkMain, error) {
	query := r.GetDB().Model(&nekomaid.ArtworkMain{}).
		Select("site, author_id, artwork_id, is_r18 = 1 AS is_r18, is_animated = 1 AS is_animated, title, full_content, created_on").
		Where("site = ? AND author_id = ? AND is_deleted = -1", target.Site, target.AuthorId)
	if target.ArtworkId != "" {
		query = query.Where("artwork_id = ?", target.ArtworkId)
	}
	var rows []nekomaid.ArtworkMain
	return rows, query.Find(&rows).Error
}

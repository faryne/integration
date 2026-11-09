package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"

	"gorm.io/plugin/dbresolver"
)

// joyu 討論版的封鎖名單（uid 或 IP）；解除封鎖是軟刪除

type RepositoryJoyuBan struct {
	*repository.Repository[av.JoyuBan]
}

func NewJoyuBan() *RepositoryJoyuBan {
	return &RepositoryJoyuBan{Repository: repository.NewRepository[av.JoyuBan](client.GetDB(enum.DBWalolita))}
}

// IsBanned uid 或 IP 有沒有在有效的封鎖名單上
func (r *RepositoryJoyuBan) IsBanned(uid, ip string) (bool, error) {
	var n int64
	err := r.GetDB().Clauses(dbresolver.Write).Model(&av.JoyuBan{}).
		Where("is_deleted = 0 AND (expires_at IS NULL OR expires_at > ?)", time.Now()).
		Where("(ban_type = ? AND value = ?) OR (ban_type = ? AND value = ?)", av.JoyuBanUID, uid, av.JoyuBanIP, ip).
		Count(&n).Error
	return n > 0, err
}

// Active 還有效的封鎖（新的在前）
func (r *RepositoryJoyuBan) Active() ([]av.JoyuBan, error) {
	var rows []av.JoyuBan
	err := r.GetDB().Clauses(dbresolver.Write).Where("is_deleted = 0 AND (expires_at IS NULL OR expires_at > ?)", time.Now()).Order("created_at DESC").Find(&rows).Error
	return rows, err
}

func (r *RepositoryJoyuBan) Create(b *av.JoyuBan) error {
	return r.GetDB().Create(b).Error
}

// Lift 解除封鎖
func (r *RepositoryJoyuBan) Lift(id uint64) error {
	return r.GetDB().Model(&av.JoyuBan{}).Where("id = ?", id).Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now()}).Error
}

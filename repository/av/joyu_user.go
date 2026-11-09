package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"

	"gorm.io/plugin/dbresolver"
)

// joyu 帳號的站內資料（暱稱、刪除狀態）；改完暱稱馬上要讀回來，讀取走 primary

type RepositoryJoyuUser struct {
	*repository.Repository[av.JoyuUser]
}

func NewJoyuUser() *RepositoryJoyuUser {
	return &RepositoryJoyuUser{Repository: repository.NewRepository[av.JoyuUser](client.GetDB(enum.DBWalolita))}
}

// FindByUIDs uid → 站內資料（沒有資料的不會出現）
func (r *RepositoryJoyuUser) FindByUIDs(uids []string) (map[string]av.JoyuUser, error) {
	out := map[string]av.JoyuUser{}
	if len(uids) == 0 {
		return out, nil
	}
	var rows []av.JoyuUser
	err := r.GetDB().Clauses(dbresolver.Write).Where("firebase_uid IN ?", uids).Find(&rows).Error
	for _, row := range rows {
		out[row.FirebaseUID] = row
	}
	return out, err
}

// SetNickname 設定暱稱（沒有資料就建立）
func (r *RepositoryJoyuUser) SetNickname(uid, nickname string) error {
	now := time.Now()
	return r.GetDB().Exec(`INSERT INTO joyu_users (firebase_uid, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), updated_at = VALUES(updated_at)`, uid, nickname, now, now).Error
}

// MarkDeleted 刪帳號：暱稱清掉、標記刪除（留言保留，名字改顯示「已刪除的帳號」）
func (r *RepositoryJoyuUser) MarkDeleted(uid string) error {
	now := time.Now()
	return r.GetDB().Exec(`INSERT INTO joyu_users (firebase_uid, nickname, is_deleted, deleted_at, created_at, updated_at) VALUES (?, '', 1, ?, ?, ?)
		ON DUPLICATE KEY UPDATE nickname = '', is_deleted = 1, deleted_at = VALUES(deleted_at), updated_at = VALUES(updated_at)`, uid, now, now, now).Error
}

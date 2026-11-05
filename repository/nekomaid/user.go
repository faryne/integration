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

// UserRepository neko 使用者（users_v2）：登入、舊會員搬家、合併與清除未驗證帳號
type UserRepository struct {
	*repository.Repository[nekomaid.User]
}

func NewUserRepository() *UserRepository {
	return &UserRepository{Repository: repository.NewRepository[nekomaid.User](client.GetDB(enum.DBNekomaid))}
}

// NormalizeEmail 比對 email 一律去空白、轉小寫（舊資料沒有統一格式）
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// ByUsername 依舊站帳號找（含已刪除／已合併的，呼叫端自己判斷狀態）；同名時取最早註冊的
func (r *UserRepository) ByUsername(username string) (*nekomaid.User, error) {
	var row nekomaid.User
	err := r.GetDB().Where("username = ? AND username <> ''", username).Order("is_deleted, id").First(&row).Error
	return &row, err
}

// ByFirebaseUID 依 Firebase UID 找（含已刪除的，被清除的帳號回來登入時要恢復）
func (r *UserRepository) ByFirebaseUID(uid string) (*nekomaid.User, error) {
	var row nekomaid.User
	err := r.GetDB().Where("firebase_uid = ?", uid).First(&row).Error
	return &row, err
}

func (r *UserRepository) ByID(id uint64) (*nekomaid.User, error) {
	var row nekomaid.User
	err := r.GetDB().Where("id = ?", id).First(&row).Error
	return &row, err
}

// UnmigratedByEmail 同 email、還沒搬進 Firebase 的舊帳號（有舊雜湊、沒刪除），依註冊先後排序
func (r *UserRepository) UnmigratedByEmail(email string) ([]nekomaid.User, error) {
	var rows []nekomaid.User
	err := r.GetDB().Where("firebase_uid IS NULL AND is_deleted = 0 AND userpass <> '' AND LOWER(TRIM(email)) = ?", NormalizeEmail(email)).
		Order("id").Find(&rows).Error
	return rows, err
}

// MergedByEmail 同 email、已被合併的舊帳號（用來回「已合併到 ○○」）
func (r *UserRepository) MergedByEmail(email string) ([]nekomaid.User, error) {
	var rows []nekomaid.User
	err := r.GetDB().Where("merged_into_id IS NOT NULL AND userpass <> '' AND LOWER(TRIM(email)) = ?", NormalizeEmail(email)).
		Order("id").Find(&rows).Error
	return rows, err
}

// BoundByEmail 已綁 Firebase 的帳號（Firebase 的 email 不會重複，所以最多一筆）；信件連結回來時用 email 找人
func (r *UserRepository) BoundByEmail(email string) (*nekomaid.User, error) {
	var row nekomaid.User
	err := r.GetDB().Where("firebase_uid IS NOT NULL AND LOWER(TRIM(email)) = ?", NormalizeEmail(email)).First(&row).Error
	return &row, err
}

func (r *UserRepository) Create(row *nekomaid.User) error {
	return r.GetDB().Create(row).Error
}

// Updates 更新指定欄位並押上 updated_at
func (r *UserRepository) Updates(id uint64, fields map[string]any) error {
	fields["updated_at"] = time.Now()
	return r.GetDB().Model(&nekomaid.User{}).Where("id = ?", id).Updates(fields).Error
}

// MergeInto 把 sources 的追蹤（畫師、作品、標籤）併到 target，重複的略過；sources soft delete 並記 merged_into_id。
// sources 的 userpass 保留：之後有人用被併的帳號登入，驗得過密碼才告訴他「已合併到 ○○」
func (r *UserRepository) MergeInto(targetID uint64, sourceIDs []uint64) error {
	if len(sourceIDs) == 0 {
		return nil
	}
	now := time.Now()
	return r.GetDB().Transaction(func(tx *gorm.DB) error {
		statements := []string{
			"INSERT IGNORE INTO users_fav_authors (user_id, site, author_id, created_on) SELECT ?, site, author_id, created_on FROM users_fav_authors WHERE user_id IN ?",
			"INSERT IGNORE INTO users_fav_artworks (user_id, site, author_id, artwork_id, created_on) SELECT ?, site, author_id, artwork_id, created_on FROM users_fav_artworks WHERE user_id IN ?",
			"INSERT IGNORE INTO users_fav_tags (user_id, tag, created_on) SELECT ?, tag, created_on FROM users_fav_tags WHERE user_id IN ?",
		}
		for _, sql := range statements {
			if err := tx.Exec(sql, targetID, sourceIDs).Error; err != nil {
				return err
			}
		}
		for _, table := range []string{"users_fav_authors", "users_fav_artworks", "users_fav_tags"} {
			if err := tx.Exec("DELETE FROM "+table+" WHERE user_id IN ?", sourceIDs).Error; err != nil {
				return err
			}
		}
		return tx.Model(&nekomaid.User{}).Where("id IN ?", sourceIDs).
			Updates(map[string]any{"is_deleted": 1, "deleted_at": now, "merged_into_id": targetID, "updated_at": now}).Error
	})
}

// SoftDeleteUnverified 清除「驗證信寄出超過 cutoff 仍未驗證」的帳號，一次最多 limit 筆，回傳清掉幾筆
func (r *UserRepository) SoftDeleteUnverified(cutoff time.Time, limit int) (int64, error) {
	var ids []uint64
	if err := r.GetDB().Model(&nekomaid.User{}).
		Where("is_deleted = 0 AND email_verified_at IS NULL AND verification_sent_at < ?", cutoff).
		Order("id").Limit(limit).Pluck("id", &ids).Error; err != nil || len(ids) == 0 {
		return 0, err
	}
	now := time.Now()
	result := r.GetDB().Model(&nekomaid.User{}).Where("id IN ?", ids).
		Updates(map[string]any{"is_deleted": 1, "deleted_at": now, "updated_at": now})
	return result.RowsAffected, result.Error
}

package av

import (
	"crypto/sha1"
	"encoding/hex"
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"

	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// joyu.fyi 的追蹤。按愛心之後馬上就要讀回來（愛心狀態、我的追蹤頁），讀取一律走 primary，避開 replica 延遲

type RepositoryJoyuFollow struct {
	*repository.Repository[av.JoyuFollow]
}

func NewJoyuFollow() *RepositoryJoyuFollow {
	return &RepositoryJoyuFollow{Repository: repository.NewRepository[av.JoyuFollow](client.GetDB(enum.DBWalolita))}
}

func followValueHash(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:])
}

// ListByUID 這個人的全部追蹤，新追蹤的在前
func (r *RepositoryJoyuFollow) ListByUID(uid string) ([]av.JoyuFollow, error) {
	var rows []av.JoyuFollow
	err := r.GetDB().Clauses(dbresolver.Write).Where("firebase_uid = ?", uid).Order("created_at DESC, id DESC").Find(&rows).Error
	return rows, err
}

func (r *RepositoryJoyuFollow) CountByUID(uid string) (int64, error) {
	var n int64
	err := r.GetDB().Clauses(dbresolver.Write).Model(&av.JoyuFollow{}).Where("firebase_uid = ?", uid).Count(&n).Error
	return n, err
}

// Add 已經追蹤過就略過（冪等）
func (r *RepositoryJoyuFollow) Add(uid, kind, value string) error {
	now := time.Now()
	row := av.JoyuFollow{FirebaseUID: uid, Kind: kind, Value: value, ValueHash: followValueHash(value), CreatedAt: &now}
	return r.GetDB().Clauses(clause.Insert{Modifier: "IGNORE"}).Create(&row).Error
}

func (r *RepositoryJoyuFollow) Remove(uid, kind, value string) error {
	return r.GetDB().Where("firebase_uid = ? AND kind = ? AND value_hash = ?", uid, kind, followValueHash(value)).Delete(&av.JoyuFollow{}).Error
}

// MoveAll 把 from 的追蹤搬到 to（匿名帳號升級時遇到既有帳號）：to 已經有的略過，搬完刪掉 from 的
func (r *RepositoryJoyuFollow) MoveAll(from, to string) error {
	db := r.GetDB()
	if err := db.Exec(`INSERT IGNORE INTO joyu_follows (firebase_uid, kind, value, value_hash, created_at)
		SELECT ?, kind, value, value_hash, created_at FROM joyu_follows WHERE firebase_uid = ?`, to, from).Error; err != nil {
		return err
	}
	return db.Where("firebase_uid = ?", from).Delete(&av.JoyuFollow{}).Error
}

// DeleteByUID 刪除帳號：這個人的全部追蹤
func (r *RepositoryJoyuFollow) DeleteByUID(uid string) error {
	return r.GetDB().Where("firebase_uid = ?", uid).Delete(&av.JoyuFollow{}).Error
}

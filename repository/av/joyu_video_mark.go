package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"

	"gorm.io/gorm"
	"gorm.io/plugin/dbresolver"
)

// joyu.fyi 片單。按下想看／看過之後馬上就要讀回來（按鈕狀態、統計、片單頁），讀取一律走 primary，避開 replica 延遲

type RepositoryJoyuVideoMark struct {
	*repository.Repository[av.JoyuVideoMark]
}

func NewJoyuVideoMark() *RepositoryJoyuVideoMark {
	return &RepositoryJoyuVideoMark{Repository: repository.NewRepository[av.JoyuVideoMark](client.GetDB(enum.DBWalolita))}
}

func (r *RepositoryJoyuVideoMark) db() *gorm.DB {
	return r.GetDB().Clauses(dbresolver.Write)
}

// ListByUID 這個人的全部片單（輕量，卡片小標用），最近改的在前
func (r *RepositoryJoyuVideoMark) ListByUID(uid string) ([]av.JoyuVideoMark, error) {
	var rows []av.JoyuVideoMark
	err := r.db().Where("firebase_uid = ?", uid).Order("updated_at DESC").Find(&rows).Error
	return rows, err
}

func (r *RepositoryJoyuVideoMark) CountByUID(uid string) (int64, error) {
	var n int64
	err := r.db().Model(&av.JoyuVideoMark{}).Where("firebase_uid = ?", uid).Count(&n).Error
	return n, err
}

// Exists 這部是不是已經在片單裡（新增時才算上限）
func (r *RepositoryJoyuVideoMark) Exists(uid, no string) (bool, error) {
	var n int64
	err := r.db().Model(&av.JoyuVideoMark{}).Where("firebase_uid = ? AND video_no = ?", uid, no).Count(&n).Error
	return n > 0, err
}

// Upsert 設定狀態與評分；已經有的只改狀態、評分與更新時間（加入時間不變）
func (r *RepositoryJoyuVideoMark) Upsert(uid, no, status string, rating int) error {
	now := time.Now()
	return r.GetDB().Exec(`INSERT INTO joyu_video_marks (firebase_uid, video_no, status, rating, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE status = VALUES(status), rating = VALUES(rating), updated_at = VALUES(updated_at)`,
		uid, no, status, rating, now, now).Error
}

func (r *RepositoryJoyuVideoMark) Remove(uid, no string) error {
	return r.GetDB().Where("firebase_uid = ? AND video_no = ?", uid, no).Delete(&av.JoyuVideoMark{}).Error
}

// Summary 一部影片的全站統計：想看、看過人數，評分人數與平均（沒人評分時平均是 0）
func (r *RepositoryJoyuVideoMark) Summary(no string) (want, watched, ratingCount int, ratingAvg float64, err error) {
	var row struct {
		Want, Watched, RatingCount int
		RatingAvg                  float64
	}
	err = r.db().Model(&av.JoyuVideoMark{}).Where("video_no = ?", no).Select(`
		COALESCE(SUM(status = 'want'), 0) AS want,
		COALESCE(SUM(status = 'watched'), 0) AS watched,
		COALESCE(SUM(rating > 0), 0) AS rating_count,
		COALESCE(AVG(NULLIF(rating, 0)), 0) AS rating_avg`).Scan(&row).Error
	return row.Want, row.Watched, row.RatingCount, row.RatingAvg, err
}

// filtered 片單頁的篩選：狀態＋評分（規則見 av.JoyuMarkedVideosRequest）
func (r *RepositoryJoyuVideoMark) filtered(uid, status, rating string) *gorm.DB {
	q := r.db().Model(&av.JoyuVideoMark{}).Where("firebase_uid = ? AND status = ?", uid, status)
	switch rating {
	case "5", "4":
		q = q.Where("rating = ?", rating)
	case "le3":
		q = q.Where("rating BETWEEN 1 AND 3")
	case "none":
		q = q.Where("rating = 0")
	}
	return q
}

// PageByUID 依加入時間（新的在前）分頁
func (r *RepositoryJoyuVideoMark) PageByUID(uid, status, rating string, page, size int) ([]av.JoyuVideoMark, int64, error) {
	var total int64
	if err := r.filtered(uid, status, rating).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []av.JoyuVideoMark
	err := r.filtered(uid, status, rating).Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

// AllByUID 符合篩選的全部（依配信日排序時，交給搜尋索引排序分頁；每人上限 5000 筆）
func (r *RepositoryJoyuVideoMark) AllByUID(uid, status, rating string) ([]av.JoyuVideoMark, error) {
	var rows []av.JoyuVideoMark
	err := r.filtered(uid, status, rating).Find(&rows).Error
	return rows, err
}

// MoveAll 匿名帳號升級時遇到既有帳號：to 已經有的以 to 為準，其餘搬過去，搬完刪掉 from 的
func (r *RepositoryJoyuVideoMark) MoveAll(from, to string) error {
	db := r.GetDB()
	if err := db.Exec(`INSERT IGNORE INTO joyu_video_marks (firebase_uid, video_no, status, rating, created_at, updated_at)
		SELECT ?, video_no, status, rating, created_at, updated_at FROM joyu_video_marks WHERE firebase_uid = ?`, to, from).Error; err != nil {
		return err
	}
	return db.Where("firebase_uid = ?", from).Delete(&av.JoyuVideoMark{}).Error
}

// DeleteByUID 刪除帳號：這個人的全部片單
func (r *RepositoryJoyuVideoMark) DeleteByUID(uid string) error {
	return r.GetDB().Where("firebase_uid = ?", uid).Delete(&av.JoyuVideoMark{}).Error
}

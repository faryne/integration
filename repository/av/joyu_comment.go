package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// joyu.fyi 討論版的留言與檢舉。送出後馬上要讀回來（剛留的言要看得到），讀取一律走 primary

type RepositoryJoyuComment struct {
	*repository.Repository[av.JoyuComment]
}

func NewJoyuComment() *RepositoryJoyuComment {
	return &RepositoryJoyuComment{Repository: repository.NewRepository[av.JoyuComment](client.GetDB(enum.DBWalolita))}
}

func (r *RepositoryJoyuComment) db() *gorm.DB {
	return r.GetDB().Clauses(dbresolver.Write)
}

func (r *RepositoryJoyuComment) Create(c *av.JoyuComment) error {
	return r.GetDB().Create(c).Error
}

func (r *RepositoryJoyuComment) Find(id uint64) (*av.JoyuComment, error) {
	var c av.JoyuComment
	if err := r.db().Where("id = ?", id).Take(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

// CountByTarget 討論版全部留言數（含回覆、不含被刪的）
func (r *RepositoryJoyuComment) CountByTarget(targetType, targetKey string) (int64, error) {
	var n int64
	err := r.db().Model(&av.JoyuComment{}).Where("target_type = ? AND target_key = ? AND is_deleted = 0", targetType, targetKey).Count(&n).Error
	return n, err
}

// TopLevel 一頁頂層留言（新的在前）與頂層總數；被刪的也要列（留佔位，底下的回覆才接得上）
func (r *RepositoryJoyuComment) TopLevel(targetType, targetKey string, page, size int) ([]av.JoyuComment, int64, error) {
	q := func() *gorm.DB {
		return r.db().Model(&av.JoyuComment{}).Where("target_type = ? AND target_key = ? AND parent_id = 0", targetType, targetKey)
	}
	var total int64
	if err := q().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []av.JoyuComment
	err := q().Order("created_at DESC, id DESC").Offset((page - 1) * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

// RepliesOf 這些頂層留言的全部回覆（先舊後新）
func (r *RepositoryJoyuComment) RepliesOf(parentIDs []uint64) ([]av.JoyuComment, error) {
	var rows []av.JoyuComment
	if len(parentIDs) == 0 {
		return rows, nil
	}
	err := r.db().Where("parent_id IN ?", parentIDs).Order("created_at ASC, id ASC").Find(&rows).Error
	return rows, err
}

// Report 檢舉：同一人對同一則只算一次，第一次才把 report_count 加一
func (r *RepositoryJoyuComment) Report(commentID uint64, uid, reason, ip string) error {
	return r.GetDB().Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		res := tx.Clauses(clause.Insert{Modifier: "IGNORE"}).Create(&av.JoyuCommentReport{CommentID: commentID, FirebaseUID: uid, Reason: reason, IP: ip, CreatedAt: &now})
		if res.Error != nil || res.RowsAffected == 0 {
			return res.Error
		}
		return tx.Model(&av.JoyuComment{}).Where("id = ?", commentID).UpdateColumn("report_count", gorm.Expr("report_count + 1")).Error
	})
}

// AdminList 後台列表：reported 被檢舉的（檢舉多的在前），其他是最新的
func (r *RepositoryJoyuComment) AdminList(tab string, page, size int) ([]av.JoyuComment, int64, error) {
	q := func() *gorm.DB {
		q := r.db().Model(&av.JoyuComment{})
		if tab == "reported" {
			q = q.Where("report_count > 0 AND is_deleted = 0")
		}
		return q
	}
	var total int64
	if err := q().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "created_at DESC, id DESC"
	if tab == "reported" {
		order = "report_count DESC, created_at DESC"
	}
	var rows []av.JoyuComment
	err := q().Order(order).Offset((page - 1) * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

// ReportReasons 各留言的檢舉原因次數：comment_id → reason → 次數
func (r *RepositoryJoyuComment) ReportReasons(ids []uint64) (map[uint64]map[string]int, error) {
	out := map[uint64]map[string]int{}
	if len(ids) == 0 {
		return out, nil
	}
	var rows []struct {
		CommentID uint64
		Reason    string
		N         int
	}
	err := r.db().Model(&av.JoyuCommentReport{}).Select("comment_id, reason, COUNT(*) AS n").Where("comment_id IN ?", ids).Group("comment_id, reason").Scan(&rows).Error
	for _, row := range rows {
		if out[row.CommentID] == nil {
			out[row.CommentID] = map[string]int{}
		}
		out[row.CommentID][row.Reason] = row.N
	}
	return out, err
}

// AdminDelete 管理員刪除（留佔位）
func (r *RepositoryJoyuComment) AdminDelete(id, adminID uint64) error {
	now := time.Now()
	return r.GetDB().Model(&av.JoyuComment{}).Where("id = ?", id).Updates(map[string]any{"is_deleted": true, "deleted_at": now, "deleted_by": adminID}).Error
}

// MoveAll 匿名帳號升級時遇到既有帳號：留言與檢舉改掛到正式帳號
func (r *RepositoryJoyuComment) MoveAll(from, to string) error {
	db := r.GetDB()
	for _, sql := range []string{
		"UPDATE joyu_comments SET firebase_uid = ? WHERE firebase_uid = ?",
		"UPDATE joyu_comments SET reply_to_uid = ? WHERE reply_to_uid = ?",
		"UPDATE IGNORE joyu_comment_reports SET firebase_uid = ? WHERE firebase_uid = ?",
	} {
		if err := db.Exec(sql, to, from).Error; err != nil {
			return err
		}
	}
	return nil
}

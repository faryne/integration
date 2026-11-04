package nekomaid

import (
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
)

// ForbiddenSubmissionRepository 版權申告（artwork_forbidden_submissions）
type ForbiddenSubmissionRepository struct {
	*repository.Repository[nekomaid.ArtworkForbiddenSubmission]
}

func NewForbiddenSubmissionRepository() *ForbiddenSubmissionRepository {
	return &ForbiddenSubmissionRepository{Repository: repository.NewRepository[nekomaid.ArtworkForbiddenSubmission](client.GetDB(enum.DBNekomaid))}
}

// withNickname 未刪除的申告，附上 artwork_authors 的暱稱
func (r *ForbiddenSubmissionRepository) withNickname() *gorm.DB {
	return r.GetDB().Model(&nekomaid.ArtworkForbiddenSubmission{}).
		Joins("LEFT JOIN artwork_authors aa ON aa.site = artwork_forbidden_submissions.site AND aa.author_id = artwork_forbidden_submissions.author_id").
		Where("artwork_forbidden_submissions.is_deleted = 0")
}

func (r *ForbiddenSubmissionRepository) Create(row *nekomaid.ArtworkForbiddenSubmission) error {
	return r.GetDB().Create(row).Error
}

// PublicSearch 公開的處理結果列表，新的在前；ipHash 有值時只列該 IP 送出的申告。
// 只選公開欄位，email、IP、說明不會出現在結果裡。
func (r *ForbiddenSubmissionRepository) PublicSearch(input nekomaid.ForbiddenSubmissionPublicRequest, ipHash string) ([]nekomaid.ForbiddenSubmissionStatus, int64, error) {
	query := r.withNickname()
	if input.Status != "" {
		query = query.Where("artwork_forbidden_submissions.status = ?", input.Status)
	}
	if ipHash != "" {
		query = query.Where("artwork_forbidden_submissions.ip_hash = ?", ipHash)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]nekomaid.ForbiddenSubmissionStatus, 0)
	err := query.Select(`artwork_forbidden_submissions.id, artwork_forbidden_submissions.site,
		artwork_forbidden_submissions.author_id, artwork_forbidden_submissions.artwork_id,
		COALESCE(aa.nickname, '') AS nickname, artwork_forbidden_submissions.status,
		artwork_forbidden_submissions.reviewer_note, artwork_forbidden_submissions.created_at,
		artwork_forbidden_submissions.reviewed_at,
		EXISTS (SELECT 1 FROM artwork_forbidden f
		        WHERE f.is_deleted = 0 AND f.site = artwork_forbidden_submissions.site
		          AND f.author_id = artwork_forbidden_submissions.author_id
		          AND f.artwork_id IN ('', artwork_forbidden_submissions.artwork_id)) AS is_forbidden`).
		Order("artwork_forbidden_submissions.id DESC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&rows).Error
	return rows, total, err
}

// Search 後台審核列表：待審的舊的先看，其他依新到舊
func (r *ForbiddenSubmissionRepository) Search(input nekomaid.ForbiddenSubmissionSearchRequest) ([]nekomaid.ForbiddenSubmissionAdminItem, int64, error) {
	query := r.withNickname()
	if input.Status != "" {
		query = query.Where("artwork_forbidden_submissions.status = ?", input.Status)
	}
	if input.Ip != "" {
		query = query.Where("artwork_forbidden_submissions.ip = ?", input.Ip)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "artwork_forbidden_submissions.id DESC"
	if input.Status == nekomaid.SubmissionPending {
		order = "artwork_forbidden_submissions.id"
	}
	rows := make([]nekomaid.ForbiddenSubmissionAdminItem, 0)
	// ip_count：同一 IP 送過的申告件數（走 idx_ip），後台一眼看出是不是同一來源在大量申告
	err := query.Select(`artwork_forbidden_submissions.*, COALESCE(aa.nickname, '') AS nickname,
		(SELECT COUNT(*) FROM artwork_forbidden_submissions s2
		 WHERE s2.ip = artwork_forbidden_submissions.ip AND s2.ip <> '' AND s2.is_deleted = 0) AS ip_count`).
		Order(order).
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&rows).Error
	return rows, total, err
}

// FindPending 待審的申告；已審過或不存在都回 ErrRecordNotFound
func (r *ForbiddenSubmissionRepository) FindPending(id uint64) (*nekomaid.ArtworkForbiddenSubmission, error) {
	var row nekomaid.ArtworkForbiddenSubmission
	err := r.GetDB().Where("id = ? AND status = ? AND is_deleted = 0", id, nekomaid.SubmissionPending).First(&row).Error
	return &row, err
}

// Review 寫入審核結果；只改仍是待審的那一列，避免兩個管理者同時審核互相覆蓋
func (r *ForbiddenSubmissionRepository) Review(id uint64, status, note string, reviewer uint64) error {
	now := time.Now()
	result := r.GetDB().Model(&nekomaid.ArtworkForbiddenSubmission{}).
		Where("id = ? AND status = ? AND is_deleted = 0", id, nekomaid.SubmissionPending).
		Updates(map[string]any{"status": status, "reviewer_note": note, "reviewed_by": reviewer, "reviewed_at": now, "updated_at": now})
	if result.Error == nil && result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

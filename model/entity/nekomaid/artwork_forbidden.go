package nekomaid

import (
	"time"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
)

// 禁抓名單的來源
const (
	ForbiddenSourceAdmin      = "admin"      // 後台手動新增
	ForbiddenSourceSubmission = "submission" // 畫師申請核准
	ForbiddenSourceLegacy     = "legacy"     // 改版前的舊資料
)

// ArtworkForbidden 禁抓名單；ArtworkId 為空字串時代表整個畫師都不能抓。
// 禁抓只把資料從 ES 拉掉，原圖（S3）與 artwork_main 都保留，解除時再重新索引回 ES。
type ArtworkForbidden struct {
	Id           uint64            `json:"id" gorm:"primaryKey"`
	Site         enum.NekomaidSite `json:"site"`
	AuthorId     string            `json:"author_id"`
	ArtworkId    string            `json:"artwork_id"`
	Source       string            `json:"source"`
	SubmissionId *uint64           `json:"submission_id"`
	Note         string            `json:"note"`
	CreatedBy    *uint64           `json:"created_by"`
	IsProceed    bool              `json:"is_proceed"`  // 同步 job 是否已讓 ES 跟這列一致（生效中＝已拉掉，已解除＝已回補）
	FinishTime   *time.Time        `json:"finish_time"` // 同步 job 完成時間
	IsDeleted    bool              `json:"-"`
	DeletedAt    *time.Time        `json:"-"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

func (ArtworkForbidden) TableName() string {
	return "artwork_forbidden"
}

// ForbiddenAdminItem 後台列表的一列：附上畫師暱稱（artwork_authors 查不到時為空字串）
type ForbiddenAdminItem struct {
	ArtworkForbidden
	Nickname string `json:"nickname"`
}

// ForbiddenSearchRequest 後台列表查詢；Keyword 比對畫師 ID、作品 ID、暱稱
type ForbiddenSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Site    string `query:"site"`
	Keyword string `query:"keyword"`
	Status  string `query:"status"` // pending：同步 job 尚未拉掉 ES；done：已拉掉
}

// ForbiddenCreateRequest 後台新增禁抓；只填 ArtworkId 時由作品資料反查畫師
type ForbiddenCreateRequest struct {
	Site      string `json:"site"`
	AuthorId  string `json:"author_id"`
	ArtworkId string `json:"artwork_id"`
	Note      string `json:"note"`
}

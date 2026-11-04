package nekomaid

import (
	"time"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
)

// 版權申告的審核狀態
const (
	SubmissionPending  = "pending"
	SubmissionApproved = "approved"
	SubmissionRejected = "rejected"
)

// ArtworkForbiddenSubmission 版權申告（作品頁送出的禁抓申請）；核准後才寫進 artwork_forbidden。
// 範圍最大到畫師：ArtworkId 空字串＝整個畫師。
type ArtworkForbiddenSubmission struct {
	Id           uint64            `json:"id" gorm:"primaryKey"`
	IpHash       string            `json:"-"` // 送出者 IP 的 HMAC 雜湊，公開查詢網址 /copyright-claim/:hash 用
	Site         enum.NekomaidSite `json:"site"`
	AuthorId     string            `json:"author_id"`
	ArtworkId    string            `json:"artwork_id"`
	ContactEmail string            `json:"contact_email"` // 選填
	Message      string            `json:"message"`       // 選填
	Status       string            `json:"status"`
	ReviewerNote string            `json:"reviewer_note"`
	ReviewedBy   *uint64           `json:"reviewed_by"`
	ReviewedAt   *time.Time        `json:"reviewed_at"`
	Ip           string            `json:"ip"` // 送出者 IP；後台用來辨認同一來源的大量申告（申請人的查詢頁不會回傳）
	IsDeleted    bool              `json:"-"`
	DeletedAt    *time.Time        `json:"-"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

func (ArtworkForbiddenSubmission) TableName() string {
	return "artwork_forbidden_submissions"
}

// ForbiddenSubmitRequest 作品頁送出的版權申告；ArtworkId 留空＝申告整個畫師。
// Website 是給機器人填的 honeypot 欄位，畫面上不顯示，有值就當作機器人。
type ForbiddenSubmitRequest struct {
	Site         string `json:"site"`
	AuthorId     string `json:"author_id"`
	ArtworkId    string `json:"artwork_id"`
	ContactEmail string `json:"contact_email"`
	Message      string `json:"message"`
	Website      string `json:"website"`
}

// ForbiddenSubmitResult 送出後回給申請人的查詢 hash（同一 IP 的所有申告共用）
type ForbiddenSubmitResult struct {
	Hash   string `json:"hash"`
	Status string `json:"status"`
}

// ForbiddenSubmissionPublicRequest 公開的處理結果列表查詢；Status 空字串＝全部
type ForbiddenSubmissionPublicRequest struct {
	entity.CommonPaginationQueryRequest
	Status string `query:"status"`
}

// ForbiddenSubmissionStatus 公開的申告處理結果；刻意不含 email、IP、說明
type ForbiddenSubmissionStatus struct {
	Id           uint64            `json:"id"`
	Site         enum.NekomaidSite `json:"site"`
	AuthorId     string            `json:"author_id"`
	ArtworkId    string            `json:"artwork_id"`
	Nickname     string            `json:"nickname"`
	Status       string            `json:"status"`
	ReviewerNote string            `json:"reviewer_note"` // 只有駁回時才有值
	CreatedAt    time.Time         `json:"created_at"`
	ReviewedAt   *time.Time        `json:"reviewed_at"`
	// IsForbidden 申告目標「現在」是否在禁抓中（整個畫師或這件作品）；跟申告本身的狀態無關——
	// 同畫師別人的申告被核准、或核准後又解除，都會反映在這裡。前端據此決定要不要放站內連結（禁抓中點了會 404）
	IsForbidden bool `json:"is_forbidden"`
}

// ForbiddenSubmissionAdminItem 後台審核列表的一列：附上畫師暱稱，以及同一 IP 送過幾件（辨認大量惡意申告）
type ForbiddenSubmissionAdminItem struct {
	ArtworkForbiddenSubmission
	Nickname string `json:"nickname"`
	IpCount  int64  `json:"ip_count"`
}

// ForbiddenSubmissionSearchRequest 後台審核列表查詢；Status 空字串＝全部，Ip 用來看同一來源的所有申告
type ForbiddenSubmissionSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Status string `query:"status"`
	Ip     string `query:"ip"`
}

// ForbiddenSubmissionReviewRequest 核准／駁回；駁回時 Note 必填，會顯示給申請人
type ForbiddenSubmissionReviewRequest struct {
	Note string `json:"note"`
}

package av

import "time"

// 追蹤的類型（joyu.fyi）
const (
	FollowKindActress  = "actress"
	FollowKindMaker    = "maker"
	FollowKindLabel    = "label"
	FollowKindSeries   = "series"
	FollowKindDirector = "director"
	FollowKindTag      = "tag"
	// FollowKindSearch 影片搜尋頁「追蹤這個搜尋」：一組精確條件的交集
	FollowKindSearch = "search"
)

// JoyuFollow joyu.fyi 的一筆追蹤；DB 不存帳號，只有 Firebase uid
type JoyuFollow struct {
	ID          uint64     `gorm:"column:id;primaryKey" json:"-"`
	FirebaseUID string     `gorm:"column:firebase_uid" json:"-"`
	Kind        string     `gorm:"column:kind" json:"kind"`
	Value       string     `gorm:"column:value" json:"value"`
	ValueHash   string     `gorm:"column:value_hash" json:"-"`
	CreatedAt   *time.Time `gorm:"column:created_at" json:"created_at"`
}

func (JoyuFollow) TableName() string {
	return "joyu_follows"
}

// JoyuFollowRequest 新增／取消追蹤
type JoyuFollowRequest struct {
	Kind  string `json:"kind"`
	Value string `json:"value"`
}

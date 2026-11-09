package av

import "time"

// 片單狀態（joyu.fyi）：想看、看過互斥
const (
	VideoMarkWant    = "want"
	VideoMarkWatched = "watched"
)

// JoyuVideoMark 一部影片在某人片單裡的狀態；rating 1～5，0 表示沒評分（只有看過才能評）
type JoyuVideoMark struct {
	FirebaseUID string     `gorm:"column:firebase_uid;primaryKey" json:"-"`
	VideoNo     string     `gorm:"column:video_no;primaryKey" json:"no"`
	Status      string     `gorm:"column:status" json:"status"`
	Rating      int        `gorm:"column:rating" json:"rating"`
	CreatedAt   *time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   *time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (JoyuVideoMark) TableName() string {
	return "joyu_video_marks"
}

// JoyuVideoMarkRequest 設定片單狀態
type JoyuVideoMarkRequest struct {
	Status string `json:"status"`
	Rating int    `json:"rating"`
}

// JoyuVideoMarkSummary 一部影片的全站統計；評分人數少於門檻時 RatingAvg 為 nil（不顯示平均）
type JoyuVideoMarkSummary struct {
	Want        int      `json:"want"`
	Watched     int      `json:"watched"`
	RatingCount int      `json:"rating_count"`
	RatingAvg   *float64 `json:"rating_avg"`
}

// JoyuMarkedVideosRequest 我的片單頁
//   - Rating：空字串全部、"5"／"4" 指定分數、"le3" 三顆以下、"none" 沒評分（只對看過有意義）
//   - Sort：空字串依加入時間（新的在前），"date" 依配信日（新的在前）
type JoyuMarkedVideosRequest struct {
	Status string `query:"status"`
	Rating string `query:"rating"`
	Sort   string `query:"sort"`
	Page   int    `query:"page"`
}

// JoyuMarkedVideo 片單頁的一筆：影片資料加上自己的狀態；影片已經不在索引裡時 Video 為 nil
type JoyuMarkedVideo struct {
	Mark  JoyuVideoMark `json:"mark"`
	Video *CleanVideo   `json:"video"`
}

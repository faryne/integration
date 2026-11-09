package av

import (
	"context"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/repository/search"
)

// VideoIndex AV 影片的搜尋索引（dmmvideos）。所有讀寫都經過這裡，換搜尋引擎（ES → Manticore）時只換實作，
// service／controller 不用動。介面上不能出現任何 ES 的概念（DSL、refresh、_id 字串…），詳見
// DevelopDocuments/search/搜尋引擎抽象層與Manticore_2026-11-06.md
type VideoIndex interface {
	// Search 一頁 30 筆，依配信日由新到舊；Shuffle 時改成隨機排序
	Search(ctx context.Context, q av.VideoIndexQuery) (search.Page[av.RawVideo], error)
	// Facets 目前條件下常見的標籤／發售商／系列／出演
	Facets(ctx context.Context, q av.VideoIndexQuery) (av.VideoFacets, error)
	// TopActresses 符合條件的影片裡，出演者依部數由多到少取前 size 位（joyu 首頁新片女優、女優頁共演女優）
	TopActresses(ctx context.Context, q av.VideoIndexQuery, size int) ([]av.VideoFacetBucket, error)
	// RecentByQueries 每組條件各自的部數、最新配信日與 perQuery 部影片（依配信日由新到舊；soonestFirst 時由近到遠，
	// 給預約作品用）；日期範圍由呼叫端放在條件裡。回傳順序跟 queries 一樣（joyu 我的追蹤頁：每個追蹤一組條件）
	RecentByQueries(ctx context.Context, queries []av.VideoIndexQuery, perQuery int, soonestFirst bool) ([]av.VideoRecent, error)
	// SearchAny 符合任一組條件的影片（一頁 30 筆，排序同 Search 的 sort），joyu 即將發售頁「我追蹤的」用
	SearchAny(ctx context.Context, queries []av.VideoIndexQuery, page int, sort string) (search.Page[av.RawVideo], error)
	// PreOrders 即將發售排程寫入、還沒被每日同步覆寫的作品（有 fetched_at）：番號（小寫）→ vid、配信日、明細抓取時間
	PreOrders(ctx context.Context) (map[string]av.VideoPreOrder, error)
	// Delete 刪掉一部（預約被取消、DMM 已查無）
	Delete(ctx context.Context, vid int) error
	// CountByDate 符合條件的影片依配信日計數（yyyy-MM-dd，由舊到新）
	CountByDate(ctx context.Context, q av.VideoIndexQuery) ([]av.VideoDateCount, error)
	// FindByNos 依 DMM 內部番號取影片（大小寫都認，找不到的不會出現在結果裡）。
	// byDate 為 true 時依配信日由新到舊、一頁 30 筆；否則一次回傳全部、順序不定（joyu 片單頁）
	FindByNos(ctx context.Context, nos []string, page int, byDate bool) (search.Page[av.RawVideo], error)
	// DateStats 符合條件的影片部數與最早／最晚配信日
	DateStats(ctx context.Context, q av.VideoIndexQuery) (av.VideoStats, error)
	// StatsByActress 全部影片依出演者名字分組統計；withDates 才算最早／最晚配信日
	StatsByActress(ctx context.Context, f av.VideoStatsFilter, withDates bool) ([]av.VideoActressStats, error)
	// Terms 欄位值依作品數由多到少（不含空字串）；contains 有值時只留包含其中任一個子字串的值
	Terms(ctx context.Context, field string, size int, contains ...string) ([]av.VideoFacetBucket, error)
	// ExistingTerms values 裡哪些值至少有一部影片用過
	ExistingTerms(ctx context.Context, field string, values []string) (map[string]bool, error)
	// Sources 依 vid 取原始文件（找不到的不會出現在結果裡）；用 map 是因為整份寫回時不能弄丟 RawVideo 沒定義的欄位
	Sources(ctx context.Context, vids []int) (map[int]map[string]any, error)
	// Index 整份寫入（覆蓋）一部影片；waitVisible 為 true 時要等寫入後馬上查得到才回傳
	Index(ctx context.Context, vid int, doc any, waitVisible bool) error
	// MarkOrphan 把這些影片標成 orphan（寫入後馬上查得到）
	MarkOrphan(ctx context.Context, vids []int) error
	// NextDelistedVids 下一批還沒標 orphan 的下架影片（一次性回補工具用，見 service/av/video_orphan_delisted.go）
	NextDelistedVids(ctx context.Context, size int) ([]int, error)
}

// NewVideoIndex 目前只有 ES 實作；Manticore adapter 與依設定切換在規格 P1 加入
func NewVideoIndex() VideoIndex {
	return videoIndexES{}
}

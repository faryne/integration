package search

// 各搜尋引擎 adapter 共用的結果型別，取代過去一路外漏到 controller 的 ES 回應

// Hit 一筆搜尋結果；ID 是文件在引擎裡的 ID（AV 影片＝vid 字串）
type Hit[T any] struct {
	ID     string
	Source T
}

// Page 一頁搜尋結果與符合條件的總筆數
type Page[T any] struct {
	Hits  []Hit[T]
	Total int64
}

// Sources 只取文件本身，給不需要 ID 的呼叫端
func (p Page[T]) Sources() []T {
	out := make([]T, 0, len(p.Hits))
	for _, h := range p.Hits {
		out = append(out, h.Source)
	}
	return out
}

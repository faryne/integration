package av

import (
	"context"
	"slices"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// joyu.fyi 女優頁頂端與共演區塊用的統計：作品數、出道（最早配信日）、最新配信日、共演女優。
// 條件跟女優頁的作品列表同一套（videoIndexQuery），兩邊數字才會一致

const coStarSize = 12

type ActressSummary struct {
	Count int `json:"count"`
	// First／Last 最早／最新配信日（yyyy/MM/dd），沒有作品時是空字串
	First   string       `json:"first"`
	Last    string       `json:"last"`
	CoStars []NewActress `json:"co_stars"`
}

func ActressVideoSummary(ctx context.Context, input avEntity.VideoQueryRequest) (*ActressSummary, error) {
	q, err := videoIndexQuery(input)
	if err != nil {
		return nil, err
	}
	idx := avRepo.NewVideoIndex()
	stats, err := idx.DateStats(ctx, q)
	if err != nil {
		return nil, err
	}
	// 多取一位，扣掉本人後還有 coStarSize 位
	buckets, err := idx.TopActresses(ctx, q, coStarSize+1)
	if err != nil {
		return nil, err
	}

	// 本人的各種名義（網址上的名字、本名、別名）都要排除；影片上的名字去掉括號別名後再比
	self := distinctValues(input.Actress)
	if row := resolveActress(input.XCityID, input.ManualID, input.DMMID); row != nil {
		self = append(append(self, row.Name), actressRowFields(*row).Aliases...)
	}
	counts := map[string]int{}
	var names []string
	for _, b := range buckets {
		name := actressBaseName(b.Value)
		if name == "" || slices.Contains(self, name) {
			continue
		}
		if _, ok := counts[name]; !ok {
			names = append(names, name)
		}
		counts[name] += b.Count
	}
	if len(names) > coStarSize {
		names = names[:coStarSize]
	}
	profiles, err := actressesByExactNames(names)
	if err != nil {
		return nil, err
	}
	out := &ActressSummary{Count: stats.Count, First: stats.First, Last: stats.Last, CoStars: []NewActress{}}
	for _, name := range names {
		item := NewActress{Name: name, Count: counts[name]}
		if rows := profiles[name]; len(rows) == 1 {
			item.Actress = &rows[0]
		}
		out.CoStars = append(out.CoStars, item)
	}
	return out, nil
}

// actressNamesLimit 一次最多查幾個名字（合輯的出演者偶爾會上百位，避免一次撈太多）
const actressNamesLimit = 100

// ActressesByNames 依出演者名字（影片上的寫法，可能帶括號別名）批次取女優資料，joyu 影片頁出演女優卡用。
// 回傳 key 是傳進來的原始名字；本名對不到、或同名有多位（分不出是誰）的不會出現在結果裡
func ActressesByNames(credits []string) (map[string]avEntity.Actress, error) {
	if len(credits) > actressNamesLimit {
		credits = credits[:actressNamesLimit]
	}
	names := make([]string, 0, len(credits))
	for _, c := range credits {
		if name := actressBaseName(c); name != "" && !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	profiles, err := actressesByExactNames(names)
	if err != nil {
		return nil, err
	}
	out := map[string]avEntity.Actress{}
	for _, c := range credits {
		if rows := profiles[actressBaseName(c)]; len(rows) == 1 {
			out[c] = rows[0]
		}
	}
	return out, nil
}

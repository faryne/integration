package av

import (
	"context"
	"slices"
	"strings"
)

const (
	topicGenreHotN  = 20
	topicGenreColdN = 20
	// 冷門類型只從出現 ≥ 1,000 部的標籤挑，排行也要有 ≥ 20 位女優，不然會挑到只有一兩部的雜訊
	topicColdMinVideos  = 1000
	topicColdMinMembers = 20
	// 類型排行：該類型 ≥ 5 部才列入，最多 1,000 位（巨乳、中出し這類標籤有 4～5 千人，全放檔案太大）
	topicGenreMinVideos  = 5
	topicGenreMaxMembers = 1000
	// topicCompilationTag 總集編會把同一批片重複算進去，類型部數一律排除
	topicCompilationTag = "ベスト・総集編"
)

// topicExcludedTags 格式／販售分類，幾乎每位女優都有，不當作類型
var topicExcludedTags = []string{
	"ハイビジョン", "単体作品", "独占配信", "4時間以上作品", "ベスト・総集編", "デジモ", "4K", "VR専用", "8KVR", "ハイクオリティVR",
	"特典画像付き", "ファン感謝・訪問", "サンプル動画", "動画", "アウトレット", "16時間以上作品", "FANZA配信限定", "配信専用", "3D",
	// 2026-10-31 實跑後補上：範圍太廣或屬於商品形式，不是類型
	"その他フェチ", "セット商品", "成人映画",
}

// isGenreTag 能不能當作類型：排除格式／販售分類、促銷標籤（〇〇30％OFF）、亂碼
func isGenreTag(tag string) bool {
	if tag == "" || slices.Contains(topicExcludedTags, tag) || strings.Contains(tag, "OFF") || strings.ContainsAny(tag, "％%") {
		return false
	}
	// 亂碼是 UTF-8 被當成 Latin-1 解碼的結果（例如 è¶…ä¹³），會出現 U+00C0～U+00FF 的字元
	return !strings.ContainsFunc(tag, func(r rune) bool { return r >= 0xC0 && r <= 0xFF })
}

type topicTagCount struct {
	Tag   string
	Count int
}

// fetchGenreTags 全部影片的標籤 facet（依部數由多到少），只留可以當作類型的標籤；標籤約 500 種，一次就拿得完
func fetchGenreTags(ctx context.Context) ([]topicTagCount, error) {
	var res struct {
		Aggregations struct {
			Tags struct {
				Buckets []struct {
					Key      string `json:"key"`
					DocCount int    `json:"doc_count"`
				} `json:"buckets"`
			} `json:"tags"`
		} `json:"aggregations"`
	}
	body := map[string]any{"size": 0, "aggs": map[string]any{"tags": map[string]any{"terms": map[string]any{"field": "tags.keyword", "size": 2000}}}}
	if err := esVideoSearch(ctx, body, &res); err != nil {
		return nil, err
	}
	var out []topicTagCount
	for _, b := range res.Aggregations.Tags.Buckets {
		if isGenreTag(b.Key) {
			out = append(out, topicTagCount{b.Key, b.DocCount})
		}
	}
	return out, nil
}

// genreCounter 算某個類型每位女優的部數（不含總集編），同一個標籤只查一次
type genreCounter struct {
	ctx    context.Context
	counts genreCounts
}

func newGenreCounter(ctx context.Context) *genreCounter {
	return &genreCounter{ctx: ctx, counts: genreCounts{}}
}

func (g *genreCounter) get(tag string) (map[string]int, error) {
	if c, ok := g.counts[tag]; ok {
		return c, nil
	}
	filter := map[string]any{"bool": map[string]any{
		"filter":   []any{map[string]any{"term": map[string]any{"tags.keyword": tag}}},
		"must_not": []any{map[string]any{"term": map[string]any{"tags.keyword": topicCompilationTag}}},
	}}
	stats, err := compositeByActress(g.ctx, filter, false)
	if err != nil {
		return nil, err
	}
	c := make(map[string]int, len(stats))
	for name, s := range stats {
		c[name] = s.Count
	}
	g.counts[tag] = c
	return c, nil
}

// pickGenreTopics 熱門＝部數前 20 名；冷門＝出現 ≥ 1,000 部的標籤裡，從部數最少的往上挑，排行人數夠的前 20 個。
// members 回傳某個類型排行會有幾位女優（只算女優資料存在的名字）
func pickGenreTopics(tags []topicTagCount, members func(tag string) (int, error)) (hot, cold []topicTagCount, err error) {
	hot = tags[:min(len(tags), topicGenreHotN)]
	for i := len(tags) - 1; i >= len(hot) && len(cold) < topicGenreColdN; i-- {
		if tags[i].Count < topicColdMinVideos {
			continue
		}
		n, err := members(tags[i].Tag)
		if err != nil {
			return nil, nil, err
		}
		if n >= topicColdMinMembers {
			cold = append(cold, tags[i])
		}
	}
	// 挑的時候由少到多，顯示時改回由多到少，跟熱門類型一致
	slices.Reverse(cold)
	return hot, cold, nil
}

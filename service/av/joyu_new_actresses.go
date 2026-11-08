package av

import (
	"context"
	"encoding/json"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
	"faryne.dev/service/search"
)

// joyu.fyi 首頁「今天有新片的女優」：最近一個有配信的日子（日本時間），依出演部數排前幾位，附上女優資料（照片、參數）。
// 首頁每個訪客都會打，資料一天只隨每日同步變一次，結果放 Redis 快取。

const (
	newActressesSize     = 30
	newActressesCacheKey = "av:joyu:new-actresses:v1"
	newActressesCacheTTL = 10 * time.Minute
)

// DMM 的配信日是日本日期；用固定時區，不依賴主機的 tzdata
var jst = time.FixedZone("JST", 9*60*60)

type NewActress struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
	// Actress 對得到唯一一位女優時才附上；對不到（新人還沒建檔）或同名多位時是 nil，前端用名字連到女優搜尋
	Actress *avEntity.Actress `json:"actress,omitempty"`
}

type NewActressesOfDay struct {
	// Date 實際採用的配信日（yyyy/MM/dd）：今天還沒有新片（每日同步之前）時是最近一個有影片的日子
	Date      string       `json:"date"`
	Actresses []NewActress `json:"actresses"`
}

func NewActressesToday(ctx context.Context) (*NewActressesOfDay, error) {
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if cached, err := r.Get(newActressesCacheKey).Result(); err == nil && cached != "" {
			var out NewActressesOfDay
			if json.Unmarshal([]byte(cached), &out) == nil {
				return &out, nil
			}
		}
	}
	out, err := buildNewActresses(ctx, time.Now().In(jst))
	if err != nil {
		return nil, err
	}
	if r != nil {
		if body, err := json.Marshal(out); err == nil {
			_ = r.Set(newActressesCacheKey, body, newActressesCacheTTL).Err()
		}
	}
	return out, nil
}

func buildNewActresses(ctx context.Context, now time.Time) (*NewActressesOfDay, error) {
	idx := avRepo.NewVideoIndex()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, jst)
	// 最近一個「今天以前（含）」有影片的配信日；DMM 清單裡可能有未來日期的預約作品，所以用 EndDate 擋掉
	tomorrow := entity.OnlyDateFormat(today.AddDate(0, 0, 1))
	stats, err := idx.DateStats(ctx, avEntity.VideoIndexQuery{VideoQueryRequest: avEntity.VideoQueryRequest{EndDate: &tomorrow}})
	if err != nil {
		return nil, err
	}
	out := &NewActressesOfDay{Actresses: []NewActress{}}
	day, err := time.ParseInLocation("2006/01/02", stats.Last, jst)
	if err != nil {
		return out, nil // 一部影片都沒有
	}
	out.Date = stats.Last
	start, end := entity.OnlyDateFormat(day), entity.OnlyDateFormat(day.AddDate(0, 0, 1))
	buckets, err := idx.TopActresses(ctx, avEntity.VideoIndexQuery{VideoQueryRequest: avEntity.VideoQueryRequest{StartDate: &start, EndDate: &end}}, newActressesSize)
	if err != nil {
		return nil, err
	}

	// 影片上的名字可能帶括號別名（「澤村レイコ（高坂保奈美）」），去掉後同一人合併計數，順序維持部數由多到少
	counts := map[string]int{}
	var names []string
	for _, b := range buckets {
		name := actressBaseName(b.Value)
		if name == "" {
			continue
		}
		if _, ok := counts[name]; !ok {
			names = append(names, name)
		}
		counts[name] += b.Count
	}
	profiles, err := actressesByExactNames(names)
	if err != nil {
		return nil, err
	}
	for _, name := range names {
		item := NewActress{Name: name, Count: counts[name]}
		if rows := profiles[name]; len(rows) == 1 {
			item.Actress = &rows[0]
		}
		out.Actresses = append(out.Actresses, item)
	}
	return out, nil
}

// actressesByExactNames 女優索引裡本名完全相符的女優，依名字分組（同名會有多位）
func actressesByExactNames(names []string) (map[string][]avEntity.Actress, error) {
	out := map[string][]avEntity.Actress{}
	if len(names) == 0 {
		return out, nil
	}
	q := map[string]any{"size": len(names) * 3}
	search.SetQuery(actressDomainQuery(actressSearchDomains), true, q)
	search.SetQuery(map[string]any{"terms": map[string]any{"name.keyword": names}}, true, q)
	_, rows, err := search.Search[avEntity.Actress, avEntity.Actress](actressIndexName(), q, fActress)
	if err != nil {
		return nil, err
	}
	for _, a := range rows {
		out[a.Name] = append(out[a.Name], a)
	}
	return out, nil
}

package av

import (
	"strings"
	"time"

	"faryne.dev/config"
	"faryne.dev/model/entity"
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/search"
)

var fVideo = func(i av.RawVideo) av.CleanVideo {
	o := av.CleanVideo{
		Url:      i.Url,
		No:       i.No,
		VodDate:  i.VodDate,
		Images:   i.Images,
		Thumb:    i.Thumb,
		Title:    i.Title,
		Labels:   i.Labels,
		Makers:   i.Makers,
		Tags:     i.Tags,
		Duration: i.Duration,
		MakerNo:  i.MakerNo,
		IsOrphan: i.IsOrphan,
	}
	if i.PublishDate != nil {
		if publishDate, ok := i.PublishDate.(string); ok {
			o.PublishDate = publishDate
		}
	}
	if i.Directors != nil {
		o.Directors = i.Directors
	}
	if i.Series != nil {
		o.Series = i.Series
	}
	if i.Actresses != nil {
		o.Actresses = i.Actresses
	}
	return o
}

// videoKeywordQuery 關鍵字：標題用片語比對，出演／系列／發售商／監督／品牌／標籤用 keyword 部分比對（「春咲」找得到「春咲あずみ」）。
// 不用 match：會把「春咲」拆成「春」「咲」做 OR，混進「思春期.com」這類不相干的品牌；
// 也不用 match_phrase：片假名整串是一個 token，「トコ」比對不到「トコダケ」。
// 只影響關鍵字；actress／series 等精確篩選參數維持完全比對
func videoKeywordQuery(keyword string) map[string]any {
	pattern := "*" + wildcardEscaper.Replace(keyword) + "*"
	should := []map[string]any{{"match_phrase": map[string]any{"title": keyword}}}
	for _, field := range []string{"actresses", "series", "makers", "directors", "labels", "tags"} {
		should = append(should, map[string]any{"wildcard": map[string]any{field + ".keyword": map[string]any{"value": pattern}}})
	}
	return map[string]any{"bool": map[string]any{"should": should, "minimum_should_match": 1}}
}

func videoNoQuery(no string) map[string]any {
	return map[string]any{
		"bool": map[string]any{
			"should": []map[string]any{
				{"term": map[string]any{"no.keyword": no}},
				// 舊資料的 no 是大寫、同步過或新資料是小寫，舊連結同步後也要找得到
				{"term": map[string]any{"no.keyword": strings.ToLower(no)}},
				{"term": map[string]any{"no.keyword": strings.ToUpper(no)}},
				{"term": map[string]any{"maker_no.keyword": no}},
			},
			"minimum_should_match": 1,
		},
	}
}

func VideoSearch(input av.VideoQueryRequest) (*entity.ElasticSearchResponse[av.RawVideo], []av.CleanVideo, error) {
	page := input.Page
	if page <= 0 {
		page = 1
	}
	var q = map[string]any{
		"size": 30,
		"from": (page - 1) * 30,
		"sort": map[string]any{"pulish_date": map[string]any{"order": "desc"}, "vod_date": map[string]any{"order": "desc"}},
	}
	applyVideoConditions(input, q)
	if input.Shuffle {
		randomizeQuery(q)
	}
	return search.Search[av.RawVideo, av.CleanVideo](config.EnvConfig().DMMVideoIndex, q, fVideo)
}

// applyVideoConditions 把搜尋條件（日期、關鍵字、精確篩選、番號）寫進 q；搜尋與篩選統計（facets）共用，兩邊結果才會一致
func applyVideoConditions(input av.VideoQueryRequest, q map[string]any) {
	if input.Year > 0 && input.Month > 0 && input.Day > 0 {
		d := time.Date(input.Year, time.Month(input.Month), input.Day, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d.Format("2006/01/02")}}}, false, q)
		search.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d.Format("2006/01/02")}}}, false, q)
	} else if input.Year > 0 && input.Month > 0 {
		d1 := time.Date(input.Year, time.Month(input.Month), 1, 0, 0, 0, 0, time.Local)
		d2 := time.Date(input.Year, time.Month(input.Month+1), 1, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, false, q)
		search.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d1.Format("2006/01/02")}}}, false, q)
	} else if input.Year > 0 {
		d1 := time.Date(input.Year, 1, 1, 0, 0, 0, 0, time.Local)
		d2 := time.Date(input.Year, 12, 31, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, false, q)
		search.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d1.Format("2006/01/02")}}}, false, q)
	} else if input.StartDate != nil && input.EndDate != nil {
		d1 := *input.StartDate
		d2 := *input.EndDate
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Time().Format("2006/01/02"), "lt": d2.Time().Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Time().Format("2006/01/02"), "lt": d2.Time().Format("2006/01/02")}}}, false, q)
		search.SetQuery(map[string]any{"range": map[string]any{"pulish_dates": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
	} else if input.StartDate != nil {
		d1 := *input.StartDate
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
		search.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
	} else if input.EndDate != nil {
		d1 := *input.EndDate
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, false, q)
		search.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, false, q)
	}
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		search.SetQuery(videoKeywordQuery(keyword), true, q)
	}
	// 標籤、演員與詳細頁 chip 的篩選一律精確比對；match 會被斷詞，點「中出し」也會撈到不相干的標籤。
	// 標籤可以複選，每個各一個 term 放在 must，也就是交集
	for _, tag := range input.Tag {
		if tag = strings.TrimSpace(tag); tag != "" {
			search.SetQuery(map[string]any{"term": map[string]any{"tags.keyword": tag}}, true, q)
		}
	}
	for field, value := range map[string]string{
		"actresses": input.Actress,
		"makers":    input.Maker,
		"labels":    input.Label,
		"series":    input.Series,
		"directors": input.Director,
	} {
		if value = strings.TrimSpace(value); value != "" {
			search.SetQuery(map[string]any{"term": map[string]any{field + ".keyword": value}}, true, q)
		}
	}
	if no := strings.TrimSpace(input.No); no != "" {
		search.SetQuery(videoNoQuery(no), true, q)
	}

}

// randomizeQuery 把既有條件包進 function_score＋random_score 改成隨機排序；
// 原本的日期排序要拿掉，否則 sort 會蓋過分數
func randomizeQuery(q map[string]any) {
	delete(q, "sort")
	inner, ok := q["query"]
	if !ok {
		inner = map[string]any{"match_all": map[string]any{}}
	}
	q["query"] = map[string]any{
		"function_score": map[string]any{
			"query":        inner,
			"random_score": map[string]any{},
			"boost_mode":   "replace",
		},
	}
}

var fActress = func(i av.Actress) av.Actress {
	return i
}

func actressBirthdaySort() []map[string]any {
	return []map[string]any{
		{
			"_script": map[string]any{
				"type":  "number",
				"order": "asc",
				"script": map[string]any{
					"lang":   "painless",
					"source": "doc['birth_year'].size() == 0 || doc['birth_year'].value <= 0 ? 1 : 0",
				},
			},
		},
		{"birth_year": map[string]any{"order": "desc"}},
		{"birth_month": map[string]any{"order": "desc"}},
		{"birth_day": map[string]any{"order": "desc"}},
	}
}

func exactStringQuery(field string, value string) map[string]any {
	return map[string]any{
		"bool": map[string]any{
			"should": []map[string]any{
				{"term": map[string]any{field + ".keyword": value}},
				{"term": map[string]any{field: value}},
				{"term": map[string]any{field: strings.ToLower(value)}},
			},
			"minimum_should_match": 1,
		},
	}
}

// actressNameQuery 姓名可部分比對（「春咲」找得到「春咲あずみ」），也比對假名；完全相符的加權排前面。
// 女優 index 約 1.6 萬筆，keyword 前後萬用字元的成本可以接受
func actressNameQuery(name string) map[string]any {
	pattern := "*" + wildcardEscaper.Replace(name) + "*"
	return map[string]any{
		"bool": map[string]any{
			"should": []map[string]any{
				{"term": map[string]any{"name.keyword": map[string]any{"value": name, "boost": 10}}},
				{"wildcard": map[string]any{"name.keyword": map[string]any{"value": pattern}}},
				{"wildcard": map[string]any{"kana.keyword": map[string]any{"value": pattern}}},
			},
			"minimum_should_match": 1,
		},
	}
}

// wildcard 查詢的特殊字元要跳脫，使用者輸入的 * ? 才會被當成一般字元
var wildcardEscaper = strings.NewReplacer(`\`, `\\`, `*`, `\*`, `?`, `\?`)

func buildActressSearchQuery(input av.ActressQueryRequest, domain string) map[string]any {
	page := input.Page
	if page <= 0 {
		page = 1
	}
	var q = map[string]any{
		"size": 30,
		"from": (page - 1) * 30,
		"sort": actressBirthdaySort(),
	}
	if domain != "" {
		search.SetQuery(exactStringQuery("domain", domain), true, q)
	}
	if name := strings.TrimSpace(input.Name); name != "" {
		search.SetQuery(actressNameQuery(name), true, q)
		// 有姓名條件時完全相符的排最前面，其餘再照生日排
		q["sort"] = append([]map[string]any{{"_score": map[string]any{"order": "desc"}}}, actressBirthdaySort()...)
	}
	if input.BirthYear > 0 && input.BirthMonth > 0 && input.BirthDay > 0 {
		search.SetQuery(map[string]any{"term": map[string]any{"birth_year": input.BirthYear}}, true, q)
		search.SetQuery(map[string]any{"term": map[string]any{"birth_month": input.BirthMonth}}, true, q)
		search.SetQuery(map[string]any{"term": map[string]any{"birth_day": input.BirthDay}}, true, q)
	} else if input.BirthYear > 0 && input.BirthMonth > 0 {
		search.SetQuery(map[string]any{"term": map[string]any{"birth_year": input.BirthYear}}, true, q)
		search.SetQuery(map[string]any{"term": map[string]any{"birth_month": input.BirthMonth}}, true, q)
	} else if input.BirthYear > 0 {
		search.SetQuery(map[string]any{"term": map[string]any{"birth_year": input.BirthYear}}, true, q)
	}
	if cup := strings.ToUpper(strings.TrimSpace(input.Cup)); cup != "" {
		search.SetQuery(exactStringQuery("cup", cup), true, q)
		q["sort"] = map[string]any{"cup.keyword": map[string]any{"order": "desc", "unmapped_type": "keyword"}}
	}
	if bloodType := strings.ToUpper(strings.TrimSpace(input.BloodType)); bloodType != "" {
		search.SetQuery(exactStringQuery("blood", bloodType), true, q)
	}
	if bLength := len(input.B); bLength > 0 {
		switch bLength {
		case 1:
			search.SetQuery(map[string]any{"term": map[string]any{"bust": input.B[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"bust": map[string]any{"gte": input.B[0], "lt": input.B[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"bust": map[string]any{"order": "desc"}}
	}
	if wLength := len(input.W); wLength > 0 {
		switch wLength {
		case 1:
			search.SetQuery(map[string]any{"term": map[string]any{"waist": input.W[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"waist": map[string]any{"gte": input.W[0], "lt": input.W[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"waist": map[string]any{"order": "desc"}}
	}
	if hLength := len(input.H); hLength > 0 {
		switch hLength {
		case 1:
			search.SetQuery(map[string]any{"term": map[string]any{"hips": input.H[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"hips": map[string]any{"gte": input.H[0], "lt": input.H[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"hips": map[string]any{"order": "desc"}}
	}
	if heightLength := len(input.Height); heightLength > 0 {
		switch heightLength {
		case 1:
			search.SetQuery(map[string]any{"term": map[string]any{"height": input.Height[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"height": map[string]any{"gte": input.Height[0], "lt": input.Height[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"height": map[string]any{"order": "desc"}}
	}
	return q
}

func xcityActressIndexReady() (bool, error) {
	q := map[string]any{
		"size": 0,
	}
	search.SetQuery(exactStringQuery("domain", actressDomainXCity), true, q)

	r, _, err := search.Search[av.Actress, av.Actress]("dmmactresses", q, fActress)
	if err != nil {
		return false, err
	}
	return r.Hits.Total.Value >= 1000, nil
}

func ActressSearch(input av.ActressQueryRequest) (*entity.ElasticSearchResponse[av.Actress], []av.Actress, error) {
	domain := actressDomainXCity
	if ready, err := xcityActressIndexReady(); err != nil {
		return nil, nil, err
	} else if !ready {
		domain = ""
	}
	q := buildActressSearchQuery(input, domain)

	return search.Search[av.Actress, av.Actress]("dmmactresses", q, fActress)
}

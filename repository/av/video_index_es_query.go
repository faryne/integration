package av

import (
	"slices"
	"strings"
	"time"

	"faryne.dev/model/entity/opendata/av"
	esdsl "faryne.dev/service/search"
)

// VideoIndex 的 ES 查詢組裝（從 service/av/search.go 原封搬過來，行為不變）

// applyVideoConditions 把搜尋條件（日期、關鍵字、精確篩選、番號）寫進 q；搜尋、篩選統計（facets）、日期統計共用，結果才會一致
func applyVideoConditions(input av.VideoIndexQuery, q map[string]any) {
	// 注意：publish_date／pulish_date（舊資料錯字）放在 should，bool 有 must 時 should 不會過濾，實際上只有 vod_date 在篩選
	if input.Year > 0 && input.Month > 0 && input.Day > 0 {
		d := time.Date(input.Year, time.Month(input.Month), input.Day, 0, 0, 0, 0, time.Local)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d.Format("2006/01/02")}}}, true, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d.Format("2006/01/02")}}}, false, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d.Format("2006/01/02")}}}, false, q)
	} else if input.Year > 0 && input.Month > 0 {
		d1 := time.Date(input.Year, time.Month(input.Month), 1, 0, 0, 0, 0, time.Local)
		d2 := time.Date(input.Year, time.Month(input.Month+1), 1, 0, 0, 0, 0, time.Local)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, true, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, false, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d1.Format("2006/01/02")}}}, false, q)
	} else if input.Year > 0 {
		d1 := time.Date(input.Year, 1, 1, 0, 0, 0, 0, time.Local)
		// 上限用隔年 1/1（lt），12/31 當天配信的影片才不會被排除
		d2 := time.Date(input.Year+1, 1, 1, 0, 0, 0, 0, time.Local)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, true, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, false, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d1.Format("2006/01/02")}}}, false, q)
	} else if input.StartDate != nil && input.EndDate != nil {
		d1 := *input.StartDate
		d2 := *input.EndDate
		esdsl.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Time().Format("2006/01/02"), "lt": d2.Time().Format("2006/01/02")}}}, true, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Time().Format("2006/01/02"), "lt": d2.Time().Format("2006/01/02")}}}, false, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"pulish_dates": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
	} else if input.StartDate != nil {
		d1 := *input.StartDate
		esdsl.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, true, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
	} else if input.EndDate != nil {
		d1 := *input.EndDate
		esdsl.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, true, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, false, q)
		esdsl.SetQuery(map[string]any{"range": map[string]any{"pulish_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, false, q)
	}
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		esdsl.SetQuery(videoKeywordQuery(keyword), true, q)
	}
	// 標籤與詳細頁 chip 的篩選一律精確比對（演員另外多認「名字（別名…）」）；match 會被斷詞，點「中出し」也會撈到不相干的標籤。
	// 標籤可以複選，每個各一個 term 放在 must，也就是交集
	for _, tag := range input.Tag {
		if tag = strings.TrimSpace(tag); tag != "" {
			esdsl.SetQuery(map[string]any{"term": map[string]any{"tags.keyword": tag}}, true, q)
		}
	}
	// any_tag 是聯集：全部放進一個 terms，整個條件仍在 must
	if tags := slices.DeleteFunc(slices.Clone(input.AnyTag), func(t string) bool { return strings.TrimSpace(t) == "" }); len(tags) > 0 {
		esdsl.SetQuery(map[string]any{"terms": map[string]any{"tags.keyword": tags}}, true, q)
	}
	if input.Actress != nil {
		esdsl.SetQuery(videoActressQuery(*input.Actress), true, q)
	}
	for field, value := range map[string]string{
		"makers":    input.Maker,
		"labels":    input.Label,
		"series":    input.Series,
		"directors": input.Director,
	} {
		if value = strings.TrimSpace(value); value != "" {
			esdsl.SetQuery(map[string]any{"term": map[string]any{field + ".keyword": value}}, true, q)
		}
	}
	if no := strings.TrimSpace(input.No); no != "" {
		esdsl.SetQuery(videoNoQuery(no), true, q)
	}
}

// videoKeywordQuery 關鍵字：標題用片語比對，出演／系列／發售商／監督／品牌／標籤用 keyword 部分比對（「春咲」找得到「春咲あずみ」）。
// 不用 match：會把「春咲」拆成「春」「咲」做 OR，混進「思春期.com」這類不相干的品牌；
// 也不用 match_phrase：片假名整串是一個 token，「トコ」比對不到「トコダケ」。
// 只影響關鍵字；actress／series 等精確篩選參數維持完全比對
func videoKeywordQuery(keyword string) map[string]any {
	pattern := "*" + esdsl.WildcardEscaper.Replace(keyword) + "*"
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

// videoActressQuery 出演者條件（規則見 av.VideoActressFilter）：名字一定要相符，
// 同一個 DMM ID 用別名發的作品才會歸到別名那一頁
func videoActressQuery(f av.VideoActressFilter) map[string]any {
	byName := actressNameVideoQuery(f.Name)
	if len(f.OwnIDs) > 0 {
		// 2026-10-30 之前的影片沒有 actress_ids，只能照名字
		legacy := map[string]any{"bool": map[string]any{"must_not": map[string]any{"exists": map[string]any{"field": "actress_ids"}}}}
		return map[string]any{"bool": map[string]any{
			"must": []map[string]any{byName, {"bool": map[string]any{
				"should":               []map[string]any{{"terms": map[string]any{"actress_ids": f.OwnIDs}}, legacy},
				"minimum_should_match": 1,
			}}},
		}}
	}
	if len(f.ClaimedIDs) == 0 {
		return byName
	}
	return map[string]any{"bool": map[string]any{
		"must":     byName,
		"must_not": map[string]any{"terms": map[string]any{"actress_ids": f.ClaimedIDs}},
	}}
}

// actressNameVideoQuery 影片出演者是這個名字：完全相符，或是「名字（別名…）」的寫法。
// prefix 只掃 keyword 的 term dictionary（全站約 5 萬個名字），成本跟 term 差不多；
// 一定要緊接括號，「あい」才不會撈到「あいり」
func actressNameVideoQuery(name string) map[string]any {
	should := []map[string]any{{"term": map[string]any{"actresses.keyword": name}}}
	for _, opener := range av.ActressAliasOpeners {
		should = append(should, map[string]any{"prefix": map[string]any{"actresses.keyword": name + opener}})
	}
	return map[string]any{"bool": map[string]any{"should": should, "minimum_should_match": 1}}
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

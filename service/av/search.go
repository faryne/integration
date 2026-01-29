package av

import (
	"encoding/json"
	"faryne.dev/model/entity"
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/search"
	"fmt"
	"time"
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

func VideoSearch(input av.VideoQueryRequest) (*entity.ElasticSearchResponse[av.RawVideo], []av.CleanVideo, error) {
	page := input.Page
	if page <= 0 {
		page = 1
	}
	var q = map[string]any{
		"size": 30,
		"from": (page - 1) * 30,
		"sort": map[string]any{"publish_date": map[string]any{"order": "desc"}, "vod_date": map[string]any{"order": "desc"}},
	}
	if input.Year > 0 && input.Month > 0 && input.Day > 0 {
		d := time.Date(input.Year, time.Month(input.Month), input.Day, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d.Format("2006/01/02")}}}, false, q)
	} else if input.Year > 0 && input.Month > 0 {
		d1 := time.Date(input.Year, time.Month(input.Month), 1, 0, 0, 0, 0, time.Local)
		d2 := time.Date(input.Year, time.Month(input.Month+1), 1, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, false, q)
	} else if input.Year > 0 {
		d1 := time.Date(input.Year, 1, 1, 0, 0, 0, 0, time.Local)
		d2 := time.Date(input.Year, 12, 31, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Format("2006/01/02"), "lt": d2.Format("2006/01/02")}}}, false, q)
	} else if input.StartDate != nil && input.EndDate != nil {
		d1 := *input.StartDate
		d2 := *input.EndDate
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Time().Format("2006/01/02"), "lt": d2.Time().Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Time().Format("2006/01/02"), "lt": d2.Time().Format("2006/01/02")}}}, false, q)
	} else if input.StartDate != nil {
		d1 := *input.StartDate
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d1.Time().Format("2006/01/02")}}}, false, q)
	} else if input.EndDate != nil {
		d1 := *input.EndDate
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"lt": d1.Time().Format("2006/01/02")}}}, false, q)
	}
	if input.Keyword != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"title": input.Keyword}}, true, q)
	}
	if input.Tag != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"tags": input.Tag}}, true, q)
	}
	if input.Actress != "" {
		search.SetQuery(map[string]any{"term": map[string]any{"actress.keyword": input.Actress}}, true, q)
	}
	if input.No != "" {
		search.SetQuery(map[string]any{"term": map[string]any{"no.keyword": input.No}}, true, q)
		search.SetQuery(map[string]any{"term": map[string]any{"maker_no.keyword": input.No}}, false, q)
	}

	c, _ := json.Marshal(q)
	fmt.Println(string(c))

	return search.Search[av.RawVideo, av.CleanVideo]("dmmvideos", q, fVideo)
}

var fActress = func(i av.Actress) av.Actress {
	return i
}

func ActressSearch(input av.ActressQueryRequest) (*entity.ElasticSearchResponse[av.Actress], []av.Actress, error) {
	page := input.Page
	if page <= 0 {
		page = 1
	}
	var q = map[string]any{
		"size": 30,
		"from": (page - 1) * 30,
		"sort": map[string]any{
			"birth_year":  map[string]any{"order": "desc"},
			"birth_month": map[string]any{"order": "desc"},
			"birth_day":   map[string]any{"order": "desc"},
		},
	}
	if input.Name != "" {
		search.SetQuery(map[string]any{"term": map[string]any{"name.keyword": input.Name}}, true, q)
	}
	if input.BirthYear > 0 && input.BirthMonth > 0 && input.BirthDay > 0 {
		search.SetQuery(map[string]any{"match": map[string]any{"birth_year": input.BirthYear, "birth_month": input.BirthMonth, "birth_day": input.BirthDay}}, true, q)
	} else if input.BirthYear > 0 && input.BirthMonth > 0 {
		search.SetQuery(map[string]any{"match": map[string]any{"birth_year": input.BirthYear, "birth_month": input.BirthMonth}}, true, q)
	} else if input.BirthYear > 0 {
		search.SetQuery(map[string]any{"match": map[string]any{"birth_year": input.BirthYear}}, true, q)
	}
	if len(input.Cup) > 0 {
		search.SetQuery(map[string]any{"match": map[string]any{"cup": input.Cup}}, true, q)
		q["sort"] = map[string]any{"cup": map[string]any{"order": "desc"}}
	}
	if input.BloodType != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"blood_type": input.BloodType}}, true, q)
	}
	if bLength := len(input.B); bLength > 0 {
		switch bLength {
		case 1:
			search.SetQuery(map[string]any{"match": map[string]any{"bust": input.B[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"bust": map[string]any{"gte": input.B[0], "lt": input.B[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"bust": map[string]any{"order": "desc"}}
	}
	if wLength := len(input.W); wLength > 0 {
		switch wLength {
		case 1:
			search.SetQuery(map[string]any{"match": map[string]any{"waist": input.W[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"waist": map[string]any{"gte": input.W[0], "lt": input.W[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"waist": map[string]any{"order": "desc"}}
	}
	if hLength := len(input.H); hLength > 0 {
		switch hLength {
		case 1:
			search.SetQuery(map[string]any{"match": map[string]any{"hips": input.H[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"hips": map[string]any{"gte": input.H[0], "lt": input.H[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"hips": map[string]any{"order": "desc"}}
	}
	if heightLength := len(input.Height); heightLength > 0 {
		switch heightLength {
		case 1:
			search.SetQuery(map[string]any{"match": map[string]any{"height": input.Height[0]}}, true, q)
		case 2:
			search.SetQuery(map[string]any{"range": map[string]any{"height": map[string]any{"gte": input.Height[0], "lt": input.Height[1]}}}, true, q)
		}
		q["sort"] = map[string]any{"height": map[string]any{"order": "desc"}}
	}

	c, _ := json.Marshal(q)
	fmt.Println(string(c))

	return search.Search[av.Actress, av.Actress]("dmmactresses", q, fActress)
}

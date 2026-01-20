package av

import (
	"faryne.dev/model/entity"
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/search"
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
	}
	if input.Year > 0 && input.Month > 0 && input.Day > 0 {
		d := time.Date(input.Year, time.Month(input.Month), input.Day, 0, 0, 0, 0, time.Local)
		search.SetQuery(map[string]any{"range": map[string]any{"publish_date": map[string]any{"gte": d.Format("2006/01/02")}}}, true, q)
		search.SetQuery(map[string]any{"range": map[string]any{"vod_date": map[string]any{"gte": d.Format("2006/01/02")}}}, false, q)
	}
	if input.Actress != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"actress": input.Actress}}, true, q)
	}

	return search.Search[av.RawVideo, av.CleanVideo]("dmmvideos", q, fVideo)

}

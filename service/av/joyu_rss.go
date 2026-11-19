package av

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"html"
	"strings"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/rss"
)

// joyu.fyi 的 RSS（規格：DevelopDocuments/opendata/joyu.fyiRSS_2026-11-19.md）：
//   - /feed/new[/女優名字]：最新配信的 100 部
//   - /feed/upcoming[/女優名字]?range=1day|1week|1month：明天起這段期間的預約作品，依 DMM 收藏數取前 100 部
//     （光明天就常有 200 部以上，照配信日排的話三種範圍會拿到同一批，所以改依人氣）
//   - 帶女優名字時只看這位，網址參數同女優頁（?xcity_id=…，同名女優才不會混在一起）
//
// 連結帶 utm（utm_source=rss、utm_medium=feed、utm_campaign=new／upcoming，女優的加 actress- 前綴），
// GA 才分得出是從 RSS 進來的；guid 用不帶 utm 的影片頁網址，之後改 utm 也不會讓閱讀器把舊項目當成新的

// joyuRSSLimit 每個 feed 最多幾部
const joyuRSSLimit = 100

// ErrJoyuRSSRange upcoming 的 range 參數不是 1day／1week／1month
var ErrJoyuRSSRange = errors.New("range must be 1day, 1week or 1month")

// joyuRSSRanges upcoming 的範圍：明天起幾天（1month 跟即將發售頁一樣是 30 天）
var joyuRSSRanges = map[string]struct {
	days  int
	label string
}{
	"1day":   {1, "明天"},
	"1week":  {7, "7 天內"},
	"1month": {upcomingDays, "30 天內"},
}

// JoyuRSSNew 最新配信的 100 部；name 空的是全站，有值是這位女優（ref 是女優頁網址上的 xcity_id／manual_id／dmm_id）
func JoyuRSSNew(ctx context.Context, name string, ref avEntity.VideoQueryRequest) (string, error) {
	return joyuRSS(ctx, avEntity.VideoQueryRequest{}, name, ref, "new", rss.Channel{
		Title:       "新片",
		Link:        JoyuOrigin + "/",
		Description: "最新配信的作品",
	})
}

// JoyuRSSUpcoming 明天起 rangeKey 這段期間最受期待的 100 部；rangeKey 空的時候是 1week，name／ref 同 JoyuRSSNew
func JoyuRSSUpcoming(ctx context.Context, rangeKey, name string, ref avEntity.VideoQueryRequest) (string, error) {
	r, ok := joyuRSSRanges[cmp.Or(rangeKey, "1week")]
	if !ok {
		return "", ErrJoyuRSSRange
	}
	now := time.Now().In(jst)
	tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, jst)
	start, end := entity.OnlyDateFormat(tomorrow), entity.OnlyDateFormat(tomorrow.AddDate(0, 0, r.days))
	req := avEntity.VideoQueryRequest{StartDate: &start, EndDate: &end, Sort: avEntity.VideoSortPopular, Release: avEntity.VideoReleaseUpcoming}
	return joyuRSS(ctx, req, name, ref, "upcoming", rss.Channel{
		Title:       "即將發售（" + r.label + "）",
		Link:        JoyuOrigin + "/upcoming",
		Description: "即將發售的作品，依 DMM 收藏數排序",
	})
}

// joyuRSS 查出最多 100 部（條件同影片搜尋），組成 RSS。
// 有指定女優時：條件加上這位、標題與說明前面放名字、頻道連結改回女優頁、utm_campaign 加 actress- 前綴
func joyuRSS(ctx context.Context, req avEntity.VideoQueryRequest, name string, ref avEntity.VideoQueryRequest, campaign string, ch rss.Channel) (string, error) {
	prefix := "joyu.fyi "
	if name != "" {
		req.Actress, req.XCityID, req.ManualID, req.DMMID = []string{name}, ref.XCityID, ref.ManualID, ref.DMMID
		prefix = "joyu.fyi・" + name + " "
		ch.Link = joyuRSSActressLink(name, ref)
		campaign = "actress-" + campaign
	}
	q, err := videoIndexQuery(req)
	if err != nil {
		return "", err
	}
	q.Size = joyuRSSLimit
	page, err := avRepo.NewVideoIndex().Search(ctx, q)
	if err != nil {
		return "", err
	}
	ch.Title, ch.Description = prefix+ch.Title, prefix+ch.Description
	ch.Link = withJoyuUTM(ch.Link, campaign)
	ch.Language = "zh-TW"
	ch.Items = make([]rss.Item, 0, len(page.Hits))
	for _, h := range page.Hits {
		ch.Items = append(ch.Items, joyuRSSItem(fVideo(h.Source), campaign))
	}
	return rss.Render(ch)
}

// joyuRSSActressLink 女優 feed 的頻道連結回女優頁：帶回同一個參數（dmm_id 女優頁網址上不會出現，就不帶）
func joyuRSSActressLink(name string, ref avEntity.VideoQueryRequest) string {
	switch {
	case ref.XCityID > 0:
		return JoyuActressURL(name, actressDomainXCity, ref.XCityID)
	case ref.ManualID > 0:
		return JoyuActressURL(name, avEntity.ActressDomainManual, ref.ManualID)
	}
	return JoyuActressURL(name, "", 0)
}

// joyuRSSItem 一部影片：標題前面放番號，內文是封面、出演、配信日與發售商（只放摘要，詳細資料點進影片頁看）
func joyuRSSItem(v avEntity.CleanVideo, campaign string) rss.Item {
	page := JoyuVideoURL(v.MakerNo, v.No)
	// 番號同影片頁網址：maker_no 優先，沒有就用大寫的 no
	code := cmp.Or(v.MakerNo, strings.ToUpper(v.No))
	date := cmp.Or(v.VodDate, v.PublishDate)
	var body []string
	if v.Thumb != "" {
		body = append(body, fmt.Sprintf(`<p><img src="%s" alt="%s"></p>`, html.EscapeString(v.Thumb), html.EscapeString(code)))
	}
	if len(v.Actresses) > 0 {
		body = append(body, "<p>出演："+html.EscapeString(strings.Join(v.Actresses, "、"))+"</p>")
	}
	if date != "" {
		body = append(body, "<p>配信："+html.EscapeString(date)+"</p>")
	}
	if len(v.Makers) > 0 {
		body = append(body, "<p>發售商："+html.EscapeString(strings.Join(v.Makers, "、"))+"</p>")
	}
	return rss.Item{
		Title:       strings.TrimSpace(code + " " + v.Title),
		Link:        withJoyuUTM(page, campaign),
		GUID:        rss.GUID{IsPermaLink: true, Value: page},
		Description: rss.Description{Value: strings.Join(body, "\n")},
		PubDate:     rss.PubDate(joyuRSSDate(date)),
		Categories:  v.Tags,
		Enclosure:   rss.ImageEnclosure(v.Thumb),
	}
}

// joyuRSSDate 配信日（yyyy/MM/dd，日本時間）→ 當天 00:00；格式不對回零值（不輸出 pubDate）
func joyuRSSDate(s string) time.Time {
	t, _ := time.ParseInLocation("2006/01/02", s, jst)
	return t
}

// withJoyuUTM 網址加上 RSS 的 utm 參數（網址本身可能已經有 query，例如女優頁的 xcity_id）
func withJoyuUTM(link, campaign string) string {
	sep := "?"
	if strings.Contains(link, "?") {
		sep = "&"
	}
	return link + sep + "utm_source=rss&utm_medium=feed&utm_campaign=" + campaign
}

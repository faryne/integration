package av

import (
	"context"
	"errors"
	"strings"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

func TestWithJoyuUTM(t *testing.T) {
	if got := withJoyuUTM("https://joyu.fyi/video/ABC-001", "new"); got != "https://joyu.fyi/video/ABC-001?utm_source=rss&utm_medium=feed&utm_campaign=new" {
		t.Fatal(got)
	}
	// 女優頁網址本身有 query，要接在後面
	if got := withJoyuUTM("https://joyu.fyi/actress/x?xcity_id=1", "actress"); !strings.HasSuffix(got, "?xcity_id=1&utm_source=rss&utm_medium=feed&utm_campaign=actress") {
		t.Fatal(got)
	}
}

func TestJoyuRSSDate(t *testing.T) {
	if got := joyuRSSDate("2026/11/19"); got.Format("2006-01-02 15:04 -0700") != "2026-11-19 00:00 +0900" {
		t.Fatal(got)
	}
	if !joyuRSSDate("").IsZero() || !joyuRSSDate("2026-11-19").IsZero() {
		t.Fatal("格式不對要回零值")
	}
}

func TestJoyuRSSItem(t *testing.T) {
	v := avEntity.CleanVideo{No: "ipvr00409", Title: "タイトル<b>", VodDate: "", PublishDate: "2026/11/19",
		Thumb: "https://example.com/a.jpg", Actresses: []string{"A", "B"}, Makers: []string{"M"}, Tags: []string{"T"}}
	it := joyuRSSItem(v, "upcoming")
	if it.Title != "IPVR00409 タイトル<b>" {
		t.Fatal(it.Title)
	}
	// guid 不帶 utm，連結帶 utm
	if it.GUID.Value != "https://joyu.fyi/video/IPVR00409" || it.Link != it.GUID.Value+"?utm_source=rss&utm_medium=feed&utm_campaign=upcoming" {
		t.Fatal(it.GUID.Value, it.Link)
	}
	// 沒有 vod_date 時用 publish_date
	if it.PubDate != "Thu, 19 Nov 2026 00:00:00 +0900" {
		t.Fatal(it.PubDate)
	}
	if !strings.Contains(it.Description.Value, "出演：A、B") || !strings.Contains(it.Description.Value, "發售商：M") {
		t.Fatal(it.Description.Value)
	}
	if it.Enclosure == nil || it.Enclosure.Type != "image/jpeg" {
		t.Fatal(it.Enclosure)
	}
}

func TestJoyuRSSUpcomingRange(t *testing.T) {
	// range 不對在查索引之前就擋掉
	if _, err := JoyuRSSUpcoming(context.Background(), "2week"); !errors.Is(err, ErrJoyuRSSRange) {
		t.Fatal(err)
	}
}

package rss

import (
	"encoding/xml"
	"strings"
	"time"
)

// RSS 2.0 輸出的共用結構：neko.maid.tw 的搜尋 RSS、joyu.fyi 的新片／即將發售 feed 共用。
// 各站只負責組 Channel／Item，序列化與 Content-Type 統一在這裡

// ContentType RSS 回應的 Content-Type
const ContentType = "application/rss+xml; charset=utf-8"

type feed struct {
	XMLName xml.Name `xml:"rss"`
	Version string   `xml:"version,attr"`
	Channel Channel  `xml:"channel"`
}

type Channel struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	Language    string `xml:"language,omitempty"`
	Items       []Item `xml:"item"`
}

type Item struct {
	Title       string      `xml:"title"`
	Link        string      `xml:"link"`
	GUID        GUID        `xml:"guid"`
	Description Description `xml:"description"`
	PubDate     string      `xml:"pubDate,omitempty"`
	Categories  []string    `xml:"category,omitempty"`
	Enclosure   *Enclosure  `xml:"enclosure,omitempty"`
}

type GUID struct {
	IsPermaLink bool   `xml:"isPermaLink,attr"`
	Value       string `xml:",chardata"`
}

// Description 內容是 HTML，用 CDATA 包起來
type Description struct {
	Value string `xml:",cdata"`
}

type Enclosure struct {
	URL    string `xml:"url,attr"`
	Type   string `xml:"type,attr"`
	Length int    `xml:"length,attr"`
}

// Render 輸出完整的 RSS 2.0 XML（含 XML header）
func Render(c Channel) (string, error) {
	body, err := xml.MarshalIndent(feed{Version: "2.0", Channel: c}, "", "  ")
	if err != nil {
		return "", err
	}
	return xml.Header + string(body), nil
}

// PubDate RSS 規定的日期格式（RFC 1123Z）；零值回空字串（pubDate 欄位就不輸出）
func PubDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(time.RFC1123Z)
}

// ImageEnclosure 圖片附件：Type 從網址的副檔名猜，猜不到當 JPEG；網址空的回 nil
func ImageEnclosure(url string) *Enclosure {
	if url == "" {
		return nil
	}
	lower := strings.ToLower(url)
	t := "image/jpeg"
	switch {
	case strings.Contains(lower, ".png"):
		t = "image/png"
	case strings.Contains(lower, ".gif"):
		t = "image/gif"
	case strings.Contains(lower, ".webp"):
		t = "image/webp"
	}
	return &Enclosure{URL: url, Type: t}
}

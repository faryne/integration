package fire_department

import (
	"net/http"
	"time"

	"faryne.dev/service/helper"
)

const crawlerRequestTimeout = 5 * time.Second

type Event struct {
	Lng          float64  `json:"lng"`
	Lat          float64  `json:"lat"`
	Type         string   `json:"event_type"`    // 事件類型
	SubType      string   `json:"sub_type"`      // 事件次類型
	Title        string   `json:"title"`         // 事件名稱
	EndpointInfo string   `json:"endpoint_info"` // 是發點名稱
	Cars         []string `json:"cars"`          // 調動車輛代號，不列出路線
	Timestamp    int64    `json:"timestamp"`     // 事件時間。如果該縣市沒給的話就是以當下時間給出去。值為 10 位數 timestamp
}

type FetchCallback func([]byte) ([]Event, error)

// Fetch 發送 HTTP 請求並使用回調函數處理響應
func Fetch(req *http.Request, cb FetchCallback) ([]Event, error) {
	content, err := helper.DoRaw(req)
	if err != nil {
		return nil, err
	}
	return cb(content)
}

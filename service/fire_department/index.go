package fire_department

import (
	"io/ioutil"
	"net/http"
)

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

func Fetch(req *http.Request, cb FetchCallback) ([]Event, error) {
	c := http.Client{}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	content, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return cb(content)
}

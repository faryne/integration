package fire_department

import (
	"github.com/goccy/go-json"
	"net/http"
	"time"
)

type NewTaipeiResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

type NewTaipeiEvent struct {
	Features []NewTaipeiFeature `json:"features"`
}

type NewTaipeiFeature struct {
	Type       string              `json:"type"`
	Properties NewTaipeiProperties `json:"properties"`
	Geometry   NewTaipeiGeometry   `json:"geometry"`
}

type NewTaipeiCoordinates [2]float64

type NewTaipeiGeometry struct {
	Type        string               `json:"type"`
	Coordinates NewTaipeiCoordinates `json:"coordinates"`
}

type NewTaipeiCaseList struct {
	Path           []NewTaipeiCoordinates `json:"path"`
	StartPointInfo string                 `json:"startPointInfo"` // 車輛代號
	StartPoint     NewTaipeiCoordinates   `json:"startPoint"`
}

type NewTaipeiProperties struct {
	Lng          float64             `json:"lng"`
	Lat          float64             `json:"lat"`
	EndpointInfo string              `json:"endPointInfo"` // 終點
	FeatureId    string              `json:"featureId"`
	Title        string              `json:"title"`
	FireType     string              `json:"fireType"`
	Type         string              `json:"type"`
	CaseList     []NewTaipeiCaseList `json:"caseList"` // 出車列表
}

func NewTaipei() ([]Event, error) {
	req, err := http.NewRequest(http.MethodGet, "https://e.ntpc.gov.tw/v3/api/map/dynamic/layer/rescue", nil)
	if err != nil {
		return nil, err
	}
	return Fetch(req, func(input []byte) ([]Event, error) {
		var out = make([]Event, 0)
		// 解析內容
		var respContent NewTaipeiResponse
		var err error
		if err = json.Unmarshal(input, &respContent); err != nil {
			return out, err
		}
		var rawEvent NewTaipeiEvent
		if err = json.Unmarshal([]byte(respContent.Data), &rawEvent); err != nil {
			return out, err
		}
		for _, f := range rawEvent.Features {
			var t = Event{}
			t.Lat = f.Properties.Lat
			t.Lng = f.Properties.Lng
			t.EndpointInfo = f.Properties.EndpointInfo
			t.Type = f.Properties.FireType
			t.SubType = f.Properties.Type
			t.Cars = make([]string, len(f.Properties.CaseList))
			for k, car := range f.Properties.CaseList {
				t.Cars[k] = car.StartPointInfo
			}
			t.Title = f.Properties.Title
			t.Timestamp = time.Now().Unix()

			out = append(out, t)
		}
		return out, nil
	})
}

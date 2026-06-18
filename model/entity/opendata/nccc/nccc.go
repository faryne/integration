package nccc

import "faryne.dev/model/entity"

type IndexInfo struct {
	Token   string              `json:"token"`
	Text    string              `json:"text"`
	Fields  map[string]string   `json:"fields,omitempty"`
	Filters map[string][]string `json:"filters,omitempty"`
}

type RecordSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Cursor     string `query:"cursor"`
	YearMonths string `query:"yearMonths"`
	Region     string `query:"region"`
	Category   string `query:"category"`
	Filters    string `query:"filters"`
}

type RecordSearchOutput struct {
	*entity.CommonESPaginationOutput[[]map[string]any]
	Index IndexInfo `json:"index"`
}

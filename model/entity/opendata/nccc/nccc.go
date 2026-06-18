package nccc

import "faryne.dev/model/entity"

type IndexInfo struct {
	Token string `json:"token"`
	Text  string `json:"text"`
}

type RecordSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Cursor     string `query:"cursor"`
	YearMonths string `query:"yearMonths"`
	Region     string `query:"region"`
	Category   string `query:"category"`
}

type FacetOption struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type RecordFacets struct {
	Regions    []FacetOption `json:"regions"`
	Categories []FacetOption `json:"categories"`
}

type RecordSearchOutput struct {
	*entity.CommonESPaginationOutput[[]map[string]any]
	Index  IndexInfo    `json:"index"`
	Facets RecordFacets `json:"facets"`
}

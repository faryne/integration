package taipower

import (
	"time"

	"faryne.dev/model/entity"
)

type NeighborSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Keyword       string   `query:"keyword"`
	YearMonths    string   `query:"yearMonths"`
	YearMonthFrom string   `query:"yearMonthFrom"`
	YearMonthTo   string   `query:"yearMonthTo"`
	CostFrom      *float64 `query:"costFrom"`
	CostTo        *float64 `query:"costTo"`
	Sort          string   `query:"sort"`
	Cursor        string   `query:"cursor"`
}

type NeighborSearchOutput struct {
	*entity.CommonESPaginationOutput[[]Neighbor]
	TotalCash float64 `json:"total_cash"`
}

type NeighborStatisticYear struct {
	Year      int     `json:"year"`
	TotalCash float64 `json:"total_cash"`
}

type NeighborStatistic struct {
	Rank      int                     `json:"rank"`
	Name      string                  `json:"name"`
	QueryName string                  `json:"query_name"`
	TotalCash float64                 `json:"total_cash"`
	Years     []NeighborStatisticYear `json:"years"`
}

type NeighborStatisticsOutput struct {
	GroupBy     string              `json:"group_by"`
	GeneratedAt time.Time           `json:"generated_at"`
	Data        []NeighborStatistic `json:"data"`
}

type Neighbor struct {
	ID            uint      `gorm:"column:id;primaryKey" json:"id"`
	ObjMonthID    int       `gorm:"column:obj_month_id" json:"obj_month_id"`
	CityArea      string    `gorm:"column:cityarea" json:"cityarea"`
	Unit          string    `gorm:"column:unit" json:"unit"`
	Summary       string    `gorm:"column:summary" json:"summary"`
	ApplyReason   string    `gorm:"column:apply_reason" json:"apply_reason"`
	Cash          float64   `gorm:"column:cash" json:"cash"`
	IsTokenize    int8      `gorm:"column:is_tokenize" json:"is_tokenize"`
	ObjYear       int       `gorm:"column:obj_year" json:"obj_year"`
	ObjMonth      int       `gorm:"column:obj_month" json:"obj_month"`
	DuplicateHash string    `gorm:"column:duplicate_hash" json:"-"`
	CreatedOn     time.Time `gorm:"column:created_on" json:"created_on"`
}

func (Neighbor) TableName() string {
	return "taipower_neighbor"
}

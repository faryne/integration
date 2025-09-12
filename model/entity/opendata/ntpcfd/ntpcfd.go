package ntpcfd

import (
	"faryne.dev/model/entity"
	"time"
)

type NTPCFDUnit struct {
	UnitName string  `json:"unit_name"`
	Address  string  `json:"address"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
}

type NTPCFD struct {
	Id             string    `json:"id"`
	ServiceType    string    `json:"service_type"`
	ServiceSubType string    `json:"service_sub_type"`
	ServiceUnit    string    `json:"service_unit"`
	ServiceAddr    string    `json:"service_addr"`
	ServiceTime    string    `json:"service_time"`
	Lat            float64   `json:"lat"`
	Lng            float64   `json:"lng"`
	GeoTpe         string    `json:"geo_type"`
	CreatedAt      time.Time `json:"created_at" gorm:"column:created_on"`
	ModTimes       int64     `json:"mod_times"`
	PosTimes       int64     `json:"pos_times"`
}

type NTPCFDEvent struct {
	Uid         string                `json:"uid"`
	ServiceType string                `json:"service_type"`
	ServiceUnit string                `json:"service_unit"`
	ServiceAddr string                `json:"service_addr"`
	ServiceTime entity.DateTimeFormat `json:"service_time"`
	Lat         float64               `json:"lat"`
	Lng         float64               `json:"lng"`
}

type NTPCFDEventRequest struct {
	ServiceType      string                `json:"service_type" query:"service_type"`
	ServiceUnit      string                `json:"service_unit" query:"service_unit"`
	ServiceStartTime entity.OnlyDateFormat `json:"service_start_time" query:"service_start_time"`
	ServiceEndTime   entity.OnlyDateFormat `json:"service_end_time" query:"service_end_time"`
}

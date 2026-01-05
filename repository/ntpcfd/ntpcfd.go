package ntpcfd

import (
	"faryne.dev/model/entity/opendata/ntpcfd"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"time"
)

func FetchAllUnits() ([]ntpcfd.NTPCFDUnit, error) {
	orm := client.GetDB(enum.DBWalolita)
	var out = make([]ntpcfd.NTPCFDUnit, 0)
	err := orm.Table("ntpcfd_units").Find(&out).Error
	return out, err
}

func FetchEvents(req ntpcfd.NTPCFDEventRequest, page, perPage int64) ([]ntpcfd.NTPCFDEvent, int64, error) {
	orm := client.GetDB(enum.DBWalolita)
	var out = make([]ntpcfd.NTPCFDEvent, 0)
	query := orm.Table("ntpcfd").Select(`
			id AS uid,
            IF(
                LENGTH(service_sub_type) = 0, 
                service_type, 
                CONCAT_WS("-", service_type, service_sub_type)
            ) AS service_type,
            service_unit, service_addr, service_time, lat, lng`)
	if req.ServiceType != "" {
		query.Where("service_type = ?", req.ServiceType)
	}
	if req.ServiceUnit != "" {
		query.Where("service_unit = ?", req.ServiceUnit)
	}
	if req.ServiceStartTime.Time().IsZero() == false {
		query.Where("service_start_time >= ?", req.ServiceStartTime.Time().Format(time.DateOnly))
	}
	if req.ServiceEndTime.Time().IsZero() == false {
		query.Where("service_end_time <= ?", req.ServiceEndTime.Time().Format(time.DateOnly))
	}
	var total int64
	err1 := query.Count(&total).Error
	if err1 != nil {
		return out, total, err1
	}
	offset := (page - 1) * perPage

	err := query.Limit(int(perPage)).Offset(int(offset)).Order("service_time DESC").Find(&out).Error
	return out, total, err
}

package yandere_tags

import (
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

func FetchTags(page, perPage int64) ([]nekomaid.YandereTagOutput, int64, error) {
	orm := client.GetDB(enum.DBWalolita)
	offset := (page - 1) * perPage
	var out = make([]nekomaid.YandereTagOutput, 0)
	var total int64
	query := orm.Select("id, name, ja_name as alias_name, counts, cat_id as type_id").
		Table("moe_tags_list")
	query.Count(&total)

	err := query.
		Limit(int(perPage)).
		Offset(int(offset)).
		Order("id asc").Find(&out).Error
	return out, total, err
}

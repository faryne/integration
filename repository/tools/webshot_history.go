package tools

import (
	"faryne.dev/model/entity/tools"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
)

type WebshotHistoryRepository struct {
	*repository.Repository[tools.WebshotHistory]
}

func NewWebshotHistory() *WebshotHistoryRepository {
	return &WebshotHistoryRepository{
		Repository: repository.NewRepository[tools.WebshotHistory](client.GetDB(enum.DBWalolita)),
	}
}

func (r *WebshotHistoryRepository) CreateHistory(input *tools.WebshotHistory) error {
	return r.GetDB().Create(input).Error
}

func (r *WebshotHistoryRepository) ListByMainId(mainId int64, page int64, perPage int64) ([]tools.WebshotHistory, int64, error) {
	var rows []tools.WebshotHistory
	var total int64
	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 10
	}
	if perPage > 100 {
		perPage = 100
	}

	if err := r.GetDB().Model(&tools.WebshotHistory{}).Where("main_id = ?", mainId).Count(&total).Error; err != nil {
		return rows, 0, err
	}

	offset := (page - 1) * perPage
	err := r.GetDB().
		Where("main_id = ?", mainId).
		Order("created_at DESC").
		Limit(int(perPage)).
		Offset(int(offset)).
		Find(&rows).Error
	return rows, total, err
}

package tools

import (
	"faryne.dev/model/entity/tools"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type WebshotMainRepository struct {
	*repository.Repository[tools.WebshotMain]
}

func NewWebshotMain() *WebshotMainRepository {
	return &WebshotMainRepository{
		Repository: repository.NewRepository[tools.WebshotMain](client.GetDB(enum.DBWalolita)),
	}
}

func (r *WebshotMainRepository) FindOrCreate(url string, urlHash string) (*tools.WebshotMain, error) {
	main := tools.WebshotMain{
		Url:     url,
		UrlHash: urlHash,
	}

	if err := r.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "url_hash"}},
		DoUpdates: clause.AssignmentColumns([]string{"url"}),
	}).Create(&main).Error; err != nil {
		return nil, err
	}

	if main.Id != 0 {
		return &main, nil
	}

	if err := r.GetDB().Where("url_hash = ?", urlHash).First(&main).Error; err != nil {
		return nil, err
	}
	return &main, nil
}

func (r *WebshotMainRepository) GetByHash(urlHash string) (*tools.WebshotMain, error) {
	var main tools.WebshotMain
	if err := r.GetDB().Where("url_hash = ?", urlHash).First(&main).Error; err != nil {
		return nil, err
	}
	return &main, nil
}

func (r *WebshotMainRepository) ListRecent(limit int) ([]tools.WebshotMain, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var rows []tools.WebshotMain
	err := r.GetDB().Order("updated_at DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

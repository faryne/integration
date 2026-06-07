package nekomaid

import (
	"errors"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type NekomaidRepository struct {
	*repository.Repository[nekomaid.ArtworkMain]
}

func NewNekomaidRepository() *NekomaidRepository {
	db := client.GetDB(enum.DBNekomaid)
	return &NekomaidRepository{
		Repository: repository.NewRepository[nekomaid.ArtworkMain](db),
	}
}

func (r *NekomaidRepository) CheckExists(site enum.NekomaidSite, authorId, artworkId string) (bool, error) {
	var count int64 = 0
	err := r.GetDB().Model(&nekomaid.ArtworkMain{}).
		Where("site = ? AND author_id = ? AND artwork_id = ?", site, authorId, artworkId).
		Count(&count).Error
	return count > 0, err
}

func (r *NekomaidRepository) CheckForbidden(site enum.NekomaidSite, authorId string) (bool, error) {
	var count int64
	err := r.GetDB().Model(&nekomaid.ArtworkForbidden{}).
		Where("site = ? AND author_id = ?", site, authorId).
		Count(&count).Error
	return count > 0, err
}

func (r *NekomaidRepository) UpdateAuthorNickname(site enum.NekomaidSite, authorId, nickname string) error {
	author := nekomaid.ArtworkAuthor{
		Site:     site,
		AuthorId: authorId,
		Nickname: nickname,
	}
	return r.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "site"}, {Name: "author_id"}},
		DoUpdates: clause.Assignments(map[string]any{"nickname": nickname}),
	}).Create(&author).Error
}

func (r *NekomaidRepository) GetAuthor(site enum.NekomaidSite, authorId string) (*nekomaid.ArtworkAuthor, error) {
	var author nekomaid.ArtworkAuthor
	err := r.GetDB().Where("site = ? AND author_id = ?", site, authorId).First(&author).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &author, err
}

func (r *NekomaidRepository) SaveArtwork(artwork *nekomaid.ArtworkMain) error {
	return r.GetDB().Create(artwork).Error
}

func (r *NekomaidRepository) GetArtwork(site enum.NekomaidSite, authorId, artworkId string) (*nekomaid.ArtworkMain, error) {
	var artwork nekomaid.ArtworkMain
	err := r.GetDB().Where("site = ? AND author_id = ? AND artwork_id = ?", site, authorId, artworkId).First(&artwork).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &artwork, err
}

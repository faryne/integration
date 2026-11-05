package nekomaid

import (
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

// FavoriteRepository 使用者追蹤的畫師（users_fav_authors）與收藏的作品（users_fav_artworks）
type FavoriteRepository struct {
	*repository.Repository[nekomaid.FavoriteAuthor]
}

func NewFavoriteRepository() *FavoriteRepository {
	return &FavoriteRepository{Repository: repository.NewRepository[nekomaid.FavoriteAuthor](client.GetDB(enum.DBNekomaid))}
}

// 禁抓中的畫師／作品不出現在追蹤列表（收藏列保留，解除禁抓後自動恢復顯示；見規格 §4.2）
const (
	notForbiddenAuthor = `NOT EXISTS (SELECT 1 FROM artwork_forbidden f WHERE f.is_deleted = 0
		AND f.site = users_fav_authors.site AND f.author_id = users_fav_authors.author_id AND f.artwork_id = '')`
	notForbiddenArtwork = `NOT EXISTS (SELECT 1 FROM artwork_forbidden f WHERE f.is_deleted = 0
		AND f.site = users_fav_artworks.site AND f.author_id = users_fav_artworks.author_id
		AND f.artwork_id IN ('', users_fav_artworks.artwork_id))`
)

// AddAuthor 追蹤畫師；已追蹤就略過
func (r *FavoriteRepository) AddAuthor(userID uint64, site, authorID string) error {
	now := time.Now()
	return r.GetDB().Clauses(clause.Insert{Modifier: "IGNORE"}).
		Create(&nekomaid.FavoriteAuthor{UserId: userID, Site: site, AuthorId: authorID, CreatedOn: &now}).Error
}

func (r *FavoriteRepository) RemoveAuthor(userID uint64, site, authorID string) error {
	return r.GetDB().Where("user_id = ? AND site = ? AND author_id = ?", userID, site, authorID).
		Delete(&nekomaid.FavoriteAuthor{}).Error
}

// AddArtwork 收藏作品；已收藏就略過
func (r *FavoriteRepository) AddArtwork(userID uint64, site, authorID, artworkID string) error {
	now := time.Now()
	return r.GetDB().Clauses(clause.Insert{Modifier: "IGNORE"}).
		Create(&nekomaid.FavoriteArtwork{UserId: userID, Site: site, AuthorId: authorID, ArtworkId: artworkID, CreatedOn: &now}).Error
}

func (r *FavoriteRepository) RemoveArtwork(userID uint64, site, authorID, artworkID string) error {
	return r.GetDB().Where("user_id = ? AND site = ? AND author_id = ? AND artwork_id = ?", userID, site, authorID, artworkID).
		Delete(&nekomaid.FavoriteArtwork{}).Error
}

// AddTag 收藏標籤；已收藏就略過
func (r *FavoriteRepository) AddTag(userID uint64, tag string) error {
	return r.GetDB().Clauses(clause.Insert{Modifier: "IGNORE"}).
		Create(&nekomaid.FavoriteTag{UserId: userID, Tag: tag, CreatedOn: time.Now()}).Error
}

func (r *FavoriteRepository) RemoveTag(userID uint64, tag string) error {
	return r.GetDB().Where("user_id = ? AND tag = ?", userID, tag).Delete(&nekomaid.FavoriteTag{}).Error
}

// ListTags 收藏的標籤（新收藏的在前）
func (r *FavoriteRepository) ListTags(userID uint64, offset, limit int) ([]nekomaid.FavoriteTagItem, int64, error) {
	query := r.GetDB().Model(&nekomaid.FavoriteTag{}).Where("user_id = ?", userID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]nekomaid.FavoriteTagItem, 0)
	err := query.Select("tag, created_on").Order("created_on DESC").Offset(offset).Limit(limit).Scan(&rows).Error
	return rows, total, err
}

// Keys 使用者全部的收藏 key（不過濾禁抓，只拿來畫按鈕狀態）
func (r *FavoriteRepository) Keys(userID uint64) (nekomaid.FavoriteKeys, error) {
	keys := nekomaid.FavoriteKeys{Authors: []string{}, Artworks: []string{}, Tags: []string{}}
	err := r.GetDB().Model(&nekomaid.FavoriteAuthor{}).Where("user_id = ?", userID).
		Pluck("CONCAT(site, '/', author_id)", &keys.Authors).Error
	if err == nil {
		err = r.GetDB().Model(&nekomaid.FavoriteArtwork{}).Where("user_id = ?", userID).
			Pluck("CONCAT(site, '/', author_id, '/', artwork_id)", &keys.Artworks).Error
	}
	if err == nil {
		err = r.GetDB().Model(&nekomaid.FavoriteTag{}).Where("user_id = ?", userID).Pluck("tag", &keys.Tags).Error
	}
	return keys, err
}

// ListAuthors 追蹤的畫師（新追蹤的在前），附 artwork_authors 的暱稱；禁抓中的不列
func (r *FavoriteRepository) ListAuthors(userID uint64, offset, limit int) ([]nekomaid.FavoriteAuthorItem, int64, error) {
	query := r.GetDB().Model(&nekomaid.FavoriteAuthor{}).Where("users_fav_authors.user_id = ? AND "+notForbiddenAuthor, userID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]nekomaid.FavoriteAuthorItem, 0)
	err := query.Select("users_fav_authors.site, users_fav_authors.author_id, users_fav_authors.created_on, COALESCE(aa.nickname, '') AS nickname").
		Joins("LEFT JOIN artwork_authors aa ON aa.site = users_fav_authors.site AND aa.author_id = users_fav_authors.author_id").
		Order("users_fav_authors.created_on DESC").Offset(offset).Limit(limit).Scan(&rows).Error
	return rows, total, err
}

// ListArtworks 收藏的作品（新收藏的在前）；禁抓中的不列
func (r *FavoriteRepository) ListArtworks(userID uint64, offset, limit int) ([]nekomaid.FavoriteArtwork, int64, error) {
	query := r.GetDB().Model(&nekomaid.FavoriteArtwork{}).Where("users_fav_artworks.user_id = ? AND "+notForbiddenArtwork, userID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]nekomaid.FavoriteArtwork, 0)
	err := query.Order("created_on DESC").Offset(offset).Limit(limit).Find(&rows).Error
	return rows, total, err
}

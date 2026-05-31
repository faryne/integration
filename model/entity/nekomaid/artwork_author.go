package nekomaid

import (
	"faryne.dev/model/enum"
)

func (ArtworkAuthor) TableName() string {
	return "artwork_authors"
}

type ArtworkAuthor struct {
	Site     enum.NekomaidSite `json:"site"`
	AuthorId string            `json:"author_id" gorm:"type:varchar(255)"`
	Nickname string            `json:"nickname"`
}

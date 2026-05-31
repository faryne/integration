package nekomaid

import (
	"faryne.dev/model/enum"
)

type ArtworkForbidden struct {
	Site     enum.NekomaidSite `json:"site"`
	AuthorId string            `json:"author_id"`
}

func (ArtworkForbidden) TableName() string {
	return "artwork_forbidden"
}

package nekomaid

import (
	"faryne.dev/model/enum"
)

type ArtworkAuthor struct {
	Site     enum.NekomaidSite `json:"site"`
	AuthorId int64             `json:"author_id"`
	Nickname string            `json:"nickname"`
}

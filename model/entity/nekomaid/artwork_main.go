package nekomaid

import (
	"faryne.dev/model/enum"
	"time"
)

type ArtworkMain struct {
	Site           enum.NekomaidSite      `json:"site"`
	AuthorId       string                 `json:"author_id"`
	ArtworkId      string                 `json:"artwork_id"`
	IsR18          bool                   `json:"is_r18"`
	IsIndexed      bool                   `json:"is_indexed"`
	IsDeleted      bool                   `json:"is_deleted"`
	IsAnimated     bool                   `json:"is_animated"`
	Title          string                 `json:"Title"`
	FullContent    ArtworkMainFullContent `json:"full_content"`
	TotalViewTimes int64                  `json:"total_view_times"`
	Version        int64                  `json:"version"`
	CreatedOn      time.Time              `json:"created_on"`
}

type ArtworkMainFullContent struct {
	From      enum.NekomaidSite `json:"from"`
	Status    string            `json:"status"`
	AuthorId  string            `json:"author_id"`
	ArtworkId string            `json:"artwork_id"`
	IsR18     int               `json:"is_r18"`
	Title     string            `json:"title"`
	Author    string            `json:"author"`
	Photos    []struct {
		Width    int    `json:"width"`
		Height   int    `json:"height"`
		Mime     string `json:"mime"`
		Ext      string `json:"ext"`
		Raw      string `json:"raw"`
		Size     int    `json:"size"`
		Filename string `json:"filename"`
		Index    int    `json:"index"`
		Url      string `json:"url"`
		Original string `json:"original"`
		FileId   string `json:"file_id"`
		KeyId    string `json:"key_id"`
	} `json:"photos"`
	Tags        []string `json:"tags"`
	Thumb       string   `json:"thumb"`
	IsAnimated  int      `json:"is_animated"`
	PreviewUrl  string   `json:"preview_url"`
	Description string   `json:"description"`
}

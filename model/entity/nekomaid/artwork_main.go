package nekomaid

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"

	"faryne.dev/model/enum"
)

func (ArtworkMain) TableName() string {
	return "artwork_main"
}

type ArtworkMain struct {
	Site           enum.NekomaidSite      `json:"site"`
	AuthorId       string                 `json:"author_id"`
	ArtworkId      string                 `json:"artwork_id"`
	IsR18          bool                   `json:"is_r18"`
	IsIndexed      bool                   `json:"is_indexed"`
	IsDeleted      bool                   `json:"is_deleted"`
	IsAnimated     bool                   `json:"is_animated"`
	Title          string                 `json:"Title"`
	FullContent    ArtworkMainFullContent `json:"full_content" gorm:"column:full_content;type:json"`
	TotalViewTimes int64                  `json:"total_view_times"`
	Version        int64                  `json:"version"`
	CreatedOn      time.Time              `json:"created_on"`
}

type ArtworkMainFullContent struct {
	From        enum.NekomaidSite `json:"from"`
	Status      string            `json:"status"`
	AuthorId    string            `json:"author_id"`
	ArtworkId   string            `json:"artwork_id"`
	IsR18       int               `json:"is_r18"`
	Title       string            `json:"title"`
	Author      string            `json:"author"`
	Photos      []ArtworkPhoto    `json:"photos"`
	Tags        []string          `json:"tags"`
	Thumb       string            `json:"thumb"`
	IsAnimated  int               `json:"is_animated"`
	PreviewUrl  string            `json:"preview_url"`
	Description string            `json:"description"`
}

type ArtworkPhoto struct {
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
}

func (c ArtworkMainFullContent) Value() (driver.Value, error) {
	data, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	return escapeNonASCIIJSON(data), nil
}

func (c *ArtworkMainFullContent) Scan(value any) error {
	if value == nil {
		*c = ArtworkMainFullContent{}
		return nil
	}

	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into ArtworkMainFullContent", value)
	}

	if len(data) == 0 {
		*c = ArtworkMainFullContent{}
		return nil
	}

	return json.Unmarshal(data, c)
}

func escapeNonASCIIJSON(data []byte) string {
	if utf8.Valid(data) && len(data) == len([]rune(string(data))) {
		return string(data)
	}

	var b strings.Builder
	b.Grow(len(data))
	for _, r := range string(data) {
		if r < utf8.RuneSelf {
			b.WriteRune(r)
			continue
		}
		if r <= 0xffff {
			fmt.Fprintf(&b, "\\u%04x", r)
			continue
		}
		encoded := utf16.Encode([]rune{r})
		for _, surrogate := range encoded {
			fmt.Fprintf(&b, "\\u%04x", surrogate)
		}
	}
	return b.String()
}

package entity

import (
	"github.com/gofiber/fiber/v3/binder"
	"reflect"
	"time"
)

type CommonPaginationOutput[T any] struct {
	Data         T      `json:"data"`
	CurrentPage  int64  `json:"current_page"`
	FirstPageUrl string `json:"first_page_url"`
	From         int64  `json:"from"`
	LastPage     int64  `json:"last_page"`
	LastPageUrl  string `json:"last_page_url"`
	NextPageUrl  string `json:"next_page_url"`
	Path         string `json:"path"`
	PerPage      int64  `json:"per_page"`
	PrevPageUrl  string `json:"prev_page_url"`
	To           int64  `json:"to"`
	Total        int64  `json:"total"`
}

type CommonPaginationQueryRequest struct {
	Page    int64 `query:"page" validate:"omitempty,gte=1"`
	PerPage int64 `query:"per_page" validate:"omitempty,gte=1,lte=100"`
}

func (r CommonPaginationQueryRequest) PageValue() int64 {
	if r.Page <= 0 {
		return 1
	}
	return r.Page
}

func (r CommonPaginationQueryRequest) PerPageValue(defaultValue ...int64) int64 {
	def := int64(30)
	if len(defaultValue) > 0 && defaultValue[0] > 0 {
		def = defaultValue[0]
	}
	if r.PerPage <= 0 {
		return def
	}
	return r.PerPage
}

// OnlyDateFormat 將日期 Marshal / Unmarshal 成 YYYY-mm-dd
type OnlyDateFormat time.Time

func (t OnlyDateFormat) Time() time.Time {
	return time.Time(t)
}

func (t OnlyDateFormat) MarshalJSON() ([]byte, error) {
	if t.Time().IsZero() {
		return []byte(`""`), nil // 或 return []byte(`null`), nil 依你的需求
	}
	formatted := t.Time().Format(time.DateOnly)
	// 用雙引號包起來成為合法 JSON 字串
	return []byte(`"` + formatted + `"`), nil
}

// DateTimeFormat -
type DateTimeFormat time.Time

func (t DateTimeFormat) Time() time.Time {
	return time.Time(t)
}

func (t DateTimeFormat) MarshalJSON() ([]byte, error) {
	if t.Time().IsZero() {
		return []byte(`""`), nil // 或 return []byte(`null`), nil 依你的需求
	}
	formatted := t.Time().Format(time.DateTime)
	// 用雙引號包起來成為合法 JSON 字串
	return []byte(`"` + formatted + `"`), nil
}

var timeConverter = func(value string) reflect.Value {
	if value == "" {
		return reflect.ValueOf(nil)
	}
	if v, err := time.Parse(time.DateOnly, value); err == nil {
		return reflect.ValueOf(OnlyDateFormat(v))
	}
	if v, err := time.Parse(time.DateTime, value); err == nil {
		return reflect.ValueOf(DateTimeFormat(v))
	}
	return reflect.Value{}
}

func init() {
	// Add custom type to the Decoder settings
	binder.SetParserDecoder(binder.ParserConfig{
		IgnoreUnknownKeys: true,
		ParserType: []binder.ParserType{
			{
				CustomType: OnlyDateFormat{},
				Converter:  timeConverter,
			},
			{
				CustomType: DateTimeFormat{},
				Converter:  timeConverter,
			},
		},
		ZeroEmpty: true,
	})

}

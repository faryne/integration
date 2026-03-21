package tools

import "faryne.dev/service/crawler"

type CrawlRequest struct {
	Uri   string                    `json:"uri" validate:"required"`
	Rules []crawler.SelectorRequest `json:"rules"`
}

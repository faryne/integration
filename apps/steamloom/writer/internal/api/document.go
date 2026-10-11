package api

import (
	"context"
	"fmt"
)

// Document 是編輯分頁要顯示的單篇故事或設定（目前唯讀）。
type Document struct {
	Kind        DocumentKind `json:"kind"`
	PublicID    string       `json:"public_id"`
	Title       string       `json:"title"`
	Summary     string       `json:"summary"`
	Status      string       `json:"status"`
	ContentType string       `json:"content_type"`
	Content     string       `json:"latest_content"`
	WordCount   uint         `json:"word_count"`
	UpdatedAt   string       `json:"updated_at"`
}

// Version 是編輯歷史的一列；後端回傳的版本含完整內文，這裡丟掉不傳給前端。
type Version struct {
	ID        uint64 `json:"id"`
	Source    string `json:"source"`
	WordCount uint   `json:"word_count"`
	CreatedAt string `json:"created_at"`
}

// documentPath：故事與設定的 API 路徑只差在 stories／lores。
func documentPath(project string, kind DocumentKind, id string) (string, error) {
	switch kind {
	case KindStory:
		return "/projects/" + project + "/stories/" + id, nil
	case KindLore:
		return "/projects/" + project + "/lores/" + id, nil
	}
	return "", fmt.Errorf("unknown document kind: %s", kind)
}

func (c *Client) Document(ctx context.Context, project string, kind DocumentKind, id string) (*Document, error) {
	path, err := documentPath(project, kind, id)
	if err != nil {
		return nil, err
	}
	doc, err := get[*Document](ctx, c, path)
	if doc != nil {
		doc.Kind = kind
	}
	return doc, err
}

func (c *Client) Versions(ctx context.Context, project string, kind DocumentKind, id string) ([]Version, error) {
	path, err := documentPath(project, kind, id)
	if err != nil {
		return nil, err
	}
	return get[[]Version](ctx, c, path+"/versions")
}

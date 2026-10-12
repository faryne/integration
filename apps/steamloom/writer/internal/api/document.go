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
// 欄位對應網站 StoryEditHistory 需要的資料（標題、回復自哪一版、存檔時跟哪一版衝突）。
type Version struct {
	ID                      uint64  `json:"id"`
	Title                   string  `json:"title"`
	Source                  string  `json:"source"`
	WordCount               uint    `json:"word_count"`
	RevertedFromVersionID   *uint64 `json:"reverted_from_version_id"`
	ConflictedWithVersionID *uint64 `json:"conflicted_with_version_id"`
	CreatedAt               string  `json:"created_at"`
}

// VersionDetail 是比對用的單一版本完整內容；設定沒有摘要，Summary 會是空字串。
type VersionDetail struct {
	ID        uint64 `json:"id"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	Content   string `json:"content"`
	Source    string `json:"source"`
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

func (c *Client) VersionDetail(ctx context.Context, project string, kind DocumentKind, id, versionID string) (*VersionDetail, error) {
	path, err := documentPath(project, kind, id)
	if err != nil {
		return nil, err
	}
	return get[*VersionDetail](ctx, c, path+"/versions/"+versionID)
}

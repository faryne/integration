package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestBuildWorkspaceSerializesEmptyCollectionsAsArrays(t *testing.T) {
	data, err := json.Marshal(buildWorkspace(nil, nil, nil, nil, nil))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "null") {
		t.Fatalf("workspace contains null collection: %s", data)
	}
}

type brokenBody struct{}

func (brokenBody) Read([]byte) (int, error) { return 0, errors.New("broken body") }
func (brokenBody) Close() error             { return nil }

func TestDecodeResponse(t *testing.T) {
	tests := []struct {
		name        string
		status      int
		contentType string
		body        io.ReadCloser
		want        []string
		wantData    string
	}{
		{name: "success", status: http.StatusOK, contentType: "application/json", body: io.NopCloser(strings.NewReader(`{"data":"ok","message":"OK"}`)), wantData: "ok"},
		{name: "server fallback string", status: http.StatusOK, contentType: "application/json", body: io.NopCloser(strings.NewReader(`"database failed"`)), want: []string{"/projects/demo/stories", "HTTP 200", "database failed"}},
		{name: "html", status: http.StatusOK, contentType: "text/html; charset=utf-8", body: io.NopCloser(strings.NewReader(`<html></html>`)), want: []string{"/projects/demo/stories", "HTTP 200", "Content-Type text/html"}},
		{name: "api error", status: http.StatusBadRequest, contentType: "application/json", body: io.NopCloser(strings.NewReader(`{"message":"bad project"}`)), want: []string{"/projects/demo/stories", "HTTP 400", "bad project"}},
		{name: "read error", status: http.StatusOK, contentType: "application/json", body: brokenBody{}, want: []string{"/projects/demo/stories", "broken body"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{StatusCode: tt.status, Header: http.Header{"Content-Type": {tt.contentType}}, Body: tt.body}
			data, err := decodeResponse[string](resp, "/projects/demo/stories")
			if data != tt.wantData {
				t.Fatalf("data = %q, want %q", data, tt.wantData)
			}
			if len(tt.want) == 0 {
				if err != nil {
					t.Fatal(err)
				}
				return
			}
			if err == nil {
				t.Fatal("expected error")
			}
			for _, part := range tt.want {
				if !strings.Contains(err.Error(), part) {
					t.Errorf("error %q does not contain %q", err, part)
				}
			}
		})
	}
}

func TestDecodeLoreCollectionPublicID(t *testing.T) {
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": {"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"data":[{"public_id":"lore-1","collection_id":"collection-public-id","title":"設定"}]}`)),
	}
	rows, err := decodeResponse[[]loreRow](resp, "/projects/demo/lores")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].CollectionID != "collection-public-id" {
		t.Fatalf("rows = %#v", rows)
	}
}

func TestBuildWorkspaceGroupsLoresByCollectionPublicID(t *testing.T) {
	ws := buildWorkspace(nil, nil,
		[]loreRow{{PublicID: "lore-1", CollectionID: "collection-public-id", Title: "已分類"}, {PublicID: "lore-2", Title: "未分類"}},
		[]collectionRow{{PublicID: "collection-public-id", Name: "人物"}}, nil,
	)
	if len(ws.LoreCollections) != 1 || len(ws.LoreCollections[0].Items) != 1 || ws.LoreCollections[0].Items[0].PublicID != "lore-1" {
		t.Fatalf("lore collections = %#v", ws.LoreCollections)
	}
	if len(ws.UncategorizedLores) != 1 || ws.UncategorizedLores[0].PublicID != "lore-2" {
		t.Fatalf("uncategorized lores = %#v", ws.UncategorizedLores)
	}
}

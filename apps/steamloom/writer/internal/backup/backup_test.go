package backup

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"faryne.dev/apps/steamloom/writer/internal/api"
)

type fakeSource struct {
	ws    *api.Workspace
	docs  map[string]*api.Document
	pages []api.ImagePage
}

func (f fakeSource) Workspace(context.Context, string) (*api.Workspace, error) { return f.ws, nil }
func (f fakeSource) Document(_ context.Context, _ string, _ api.DocumentKind, id string) (*api.Document, error) {
	return f.docs[id], nil
}
func (f fakeSource) ImagePages(context.Context, string, string) ([]api.ImagePage, error) {
	return f.pages, nil
}

// 冊／設定集分資料夾、同名檔案加 ID 尾碼、front matter＋原文、圖像作品下載圖片、manifest 對得上。
func TestWriteBackup(t *testing.T) {
	images := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("jpeg-bytes"))
	}))
	defer images.Close()
	src := fakeSource{
		ws: &api.Workspace{
			Volumes:            []api.Group{{Name: "第一冊", Items: []api.DocumentItem{{Kind: api.KindStory, PublicID: "s1", Title: "第一話"}, {Kind: api.KindStory, PublicID: "s2", Title: "插畫", ContentType: "image"}}}},
			LoreCollections:    []api.Group{{Name: "角色", Items: []api.DocumentItem{{Kind: api.KindLore, PublicID: "l1", Title: "芷瑄"}}}},
			UncategorizedLores: []api.DocumentItem{{Kind: api.KindLore, PublicID: "l2", Title: "世界觀/地圖"}, {Kind: api.KindLore, PublicID: "l3", Title: "世界觀/地圖"}},
		},
		docs: map[string]*api.Document{
			"s1": {Kind: api.KindStory, PublicID: "s1", Title: "第一話", Status: "completed", Content: "# ⟦a⟧開場⟦/a⟧\n內文"},
			"s2": {Kind: api.KindStory, PublicID: "s2", Title: "插畫", ContentType: "image"},
			"l1": {Kind: api.KindLore, PublicID: "l1", Title: "芷瑄", Content: "設定內容"},
			"l2": {Kind: api.KindLore, PublicID: "l2", Title: "世界觀/地圖"},
			"l3": {Kind: api.KindLore, PublicID: "l3", Title: "世界觀/地圖"},
		},
		pages: []api.ImagePage{{AssetPublicID: "a1", ImageURL: images.URL + "/1", Description: "封面"}},
	}
	var buf bytes.Buffer
	if err := Write(context.Background(), &buf, src, images.Client(), api.Project{PublicID: "p1", Name: "測試"}, true); err != nil {
		t.Fatal(err)
	}
	archive, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatal(err)
	}
	files := map[string]string{}
	for _, f := range archive.File {
		r, _ := f.Open()
		data, _ := io.ReadAll(r)
		r.Close()
		files[f.Name] = string(data)
	}
	story := files["stories/01-第一冊/01-第一話.md"]
	if !strings.Contains(story, `title: "第一話"`) || !strings.Contains(story, "status: completed") || !strings.HasSuffix(story, "# ⟦a⟧開場⟦/a⟧\n內文") {
		t.Fatalf("story file = %q", story)
	}
	if !strings.Contains(files["stories/01-第一冊/02-插畫.md"], "asset: a1 — 封面") || files["images/s2/01.jpg"] != "jpeg-bytes" {
		t.Fatalf("image story export missing: %v", keys(files))
	}
	for _, want := range []string{"lores/角色/芷瑄.md", "lores/世界觀_地圖.md", "lores/世界觀_地圖-l3.md", "manifest.json"} {
		if _, ok := files[want]; !ok {
			t.Fatalf("missing %s in %v", want, keys(files))
		}
	}
	var manifest Manifest
	if err := json.Unmarshal([]byte(files["manifest.json"]), &manifest); err != nil || len(manifest.Entries) != 5 || manifest.Entries[1].Images[0] != "images/s2/01.jpg" {
		t.Fatalf("manifest = %+v, err = %v", manifest, err)
	}
}

func keys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

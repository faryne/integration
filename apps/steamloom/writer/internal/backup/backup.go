// Package backup 把整個專案匯出成一個 zip（作者自己的本機備份），只讀取、不寫入 SteamLoom。
//
// 結構：
//
//	manifest.json                     專案資訊＋每篇故事／設定在 zip 裡的路徑與排序（還原或檢查用）
//	stories/01-冊名/01-標題.md         故事依冊分資料夾；未分冊的直接放 stories/
//	lores/設定集名/標題.md             設定依設定集分資料夾；未歸類的直接放 lores/
//	images/<故事 ID>/01.png           圖像作品的每頁圖片（includeImages 才下載）
//
// 每個 .md 開頭是 YAML front matter（標題、ID、狀態、更新時間），後面接原始 Markdown，
// 章節 marker（⟦…⟧）照原樣保留，日後還原才不會失真。
package backup

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/api"
)

// Source 是匯出需要的唯讀 API（*api.Client 實作）；抽成介面方便測試。
type Source interface {
	Workspace(ctx context.Context, project string) (*api.Workspace, error)
	Document(ctx context.Context, project string, kind api.DocumentKind, id string) (*api.Document, error)
	ImagePages(ctx context.Context, project, story string) ([]api.ImagePage, error)
}

// Entry 是 manifest 裡的一篇；Group 是所在冊／設定集名稱（空字串＝未分冊／未歸類）。
type Entry struct {
	Kind        api.DocumentKind `json:"kind"`
	PublicID    string           `json:"public_id"`
	Title       string           `json:"title"`
	ContentType string           `json:"content_type,omitempty"`
	Status      string           `json:"status,omitempty"`
	Group       string           `json:"group,omitempty"`
	Order       int              `json:"order"`
	File        string           `json:"file"`
	Images      []string         `json:"images,omitempty"`
}

type Manifest struct {
	Format     string      `json:"format"`
	ExportedAt string      `json:"exported_at"`
	Project    api.Project `json:"project"`
	Entries    []Entry     `json:"entries"`
}

// imageExtensions：SteamLoom 資產只接受這四種；mime.ExtensionsByType 對 JPEG 會先給 .jfif，不用它。
var imageExtensions = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

// fetchConcurrency 是同時抓幾篇文件；太高會讓後端瞬間收到一堆請求。
const fetchConcurrency = 4

// Write 把專案寫成 zip。includeImages 時一併下載圖像作品每頁的圖片（大專案會很大、比較慢）。
func Write(ctx context.Context, w io.Writer, src Source, client *http.Client, project api.Project, includeImages bool) error {
	ws, err := src.Workspace(ctx, project.PublicID)
	if err != nil {
		return fmt.Errorf("讀取工作台失敗：%w", err)
	}
	entries := plan(ws)
	docs := make([]*api.Document, len(entries))
	if err := forEach(ctx, len(entries), func(i int) error {
		doc, err := src.Document(ctx, project.PublicID, entries[i].Kind, entries[i].PublicID)
		if err != nil {
			return fmt.Errorf("讀取〈%s〉失敗：%w", entries[i].Title, err)
		}
		docs[i] = doc
		return nil
	}); err != nil {
		return err
	}

	archive := zip.NewWriter(w)
	for i := range entries {
		entry, doc := &entries[i], docs[i]
		entry.Status = doc.Status
		body := frontMatter(doc) + doc.Content
		if entry.ContentType == "image" {
			pages, err := src.ImagePages(ctx, project.PublicID, entry.PublicID)
			if err != nil {
				return fmt.Errorf("讀取圖像作品〈%s〉的頁面失敗：%w", entry.Title, err)
			}
			body += imagePageList(pages)
			if includeImages {
				if entry.Images, err = writeImages(ctx, archive, client, entry.PublicID, pages); err != nil {
					return fmt.Errorf("下載〈%s〉的圖片失敗：%w", entry.Title, err)
				}
			}
		}
		if err := writeFile(archive, entry.File, []byte(body)); err != nil {
			return err
		}
	}
	manifest, err := json.MarshalIndent(Manifest{Format: "steamloom-writer-backup/v1", ExportedAt: time.Now().Format(time.RFC3339), Project: project, Entries: entries}, "", "  ")
	if err != nil {
		return err
	}
	if err := writeFile(archive, "manifest.json", manifest); err != nil {
		return err
	}
	return archive.Close()
}

// plan 依工作台的樹狀順序排好每篇的 zip 路徑；同一資料夾內檔名重複時加上 ID 尾碼。
func plan(ws *api.Workspace) []Entry {
	var entries []Entry
	used := map[string]bool{}
	add := func(kind api.DocumentKind, dir, group string, items []api.DocumentItem, numbered bool) {
		for i, item := range items {
			name := safeName(item.Title)
			if numbered {
				name = fmt.Sprintf("%02d-%s", i+1, name)
			}
			file := path.Join(dir, name+".md")
			if used[file] {
				file = path.Join(dir, fmt.Sprintf("%s-%s.md", name, item.PublicID))
			}
			used[file] = true
			entries = append(entries, Entry{Kind: kind, PublicID: item.PublicID, Title: item.Title, ContentType: item.ContentType, Group: group, Order: i + 1, File: file})
		}
	}
	for i, volume := range ws.Volumes {
		add(api.KindStory, path.Join("stories", fmt.Sprintf("%02d-%s", i+1, safeName(volume.Name))), volume.Name, volume.Items, true)
	}
	add(api.KindStory, "stories", "", ws.UngroupedStories, true)
	for _, collection := range ws.LoreCollections {
		add(api.KindLore, path.Join("lores", safeName(collection.Name)), collection.Name, collection.Items, false)
	}
	add(api.KindLore, "lores", "", ws.UncategorizedLores, false)
	return entries
}

// forEach 以有限並行跑 n 個工作，遇到第一個錯誤就停（其餘的仍會跑完目前這一批）。
func forEach(ctx context.Context, n int, work func(int) error) error {
	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		firstErr error
	)
	slots := make(chan struct{}, fetchConcurrency)
	for i := range n {
		mu.Lock()
		failed := firstErr != nil
		mu.Unlock()
		if failed || ctx.Err() != nil {
			break
		}
		slots <- struct{}{}
		wg.Add(1)
		go func() {
			defer func() { <-slots; wg.Done() }()
			if err := work(i); err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if firstErr != nil {
		return firstErr
	}
	return ctx.Err()
}

func frontMatter(doc *api.Document) string {
	lines := []string{"---", "title: " + quote(doc.Title), "public_id: " + doc.PublicID, "kind: " + string(doc.Kind)}
	if doc.Status != "" {
		lines = append(lines, "status: "+doc.Status)
	}
	if doc.Summary != "" {
		lines = append(lines, "summary: "+quote(doc.Summary))
	}
	if doc.UpdatedAt != "" {
		lines = append(lines, "updated_at: "+doc.UpdatedAt)
	}
	return strings.Join(append(lines, "---", "", ""), "\n")
}

// quote 用 JSON 字串格式包起來：也是合法的 YAML 雙引號字串，標題裡有冒號、引號都不會壞。
func quote(value string) string {
	raw, _ := json.Marshal(value)
	return string(raw)
}

// imagePageList 把圖像作品的頁面附在內文後面；圖片網址是有時效的簽名網址，不寫進去，只留資產 ID 與說明。
func imagePageList(pages []api.ImagePage) string {
	if len(pages) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n\n<!-- 圖像作品頁面 -->\n")
	for i, page := range pages {
		fmt.Fprintf(&b, "%d. asset: %s", i+1, page.AssetPublicID)
		if desc := strings.TrimSpace(page.Description); desc != "" {
			fmt.Fprintf(&b, " — %s", strings.ReplaceAll(desc, "\n", " "))
		}
		b.WriteString("\n")
	}
	return b.String()
}

func writeImages(ctx context.Context, archive *zip.Writer, client *http.Client, story string, pages []api.ImagePage) ([]string, error) {
	files := make([]string, 0, len(pages))
	for i, page := range pages {
		if page.ImageURL == "" {
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, page.ImageURL, nil)
		if err != nil {
			return nil, err
		}
		res, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		if res.StatusCode != http.StatusOK {
			res.Body.Close()
			return nil, fmt.Errorf("第 %d 頁回傳 HTTP %d", i+1, res.StatusCode)
		}
		ext, ok := imageExtensions[strings.Split(res.Header.Get("Content-Type"), ";")[0]]
		if !ok {
			ext = ".img"
		}
		file := path.Join("images", story, fmt.Sprintf("%02d%s", i+1, ext))
		out, err := archive.Create(file)
		if err == nil {
			_, err = io.Copy(out, res.Body)
		}
		res.Body.Close()
		if err != nil {
			return nil, err
		}
		files = append(files, file)
	}
	return files, nil
}

func writeFile(archive *zip.Writer, name string, data []byte) error {
	out, err := archive.Create(name)
	if err != nil {
		return err
	}
	_, err = out.Write(data)
	return err
}

// FileName 是存檔對話框的預設檔名：專案名稱-日期.zip
func FileName(project api.Project, now time.Time) string {
	return fmt.Sprintf("%s-%s.zip", safeName(project.Name), now.Format("20060102"))
}

// safeName 去掉各作業系統檔名不允許的字元，空白標題給「未命名」，過長的截斷。
func safeName(title string) string {
	name := strings.Map(func(r rune) rune {
		if strings.ContainsRune(`/\:*?"<>|`, r) || r < 0x20 {
			return '_'
		}
		return r
	}, strings.TrimSpace(title))
	name = strings.Trim(name, ". ")
	if name == "" {
		name = "未命名"
	}
	if runes := []rune(name); len(runes) > 60 {
		name = string(runes[:60])
	}
	return name
}

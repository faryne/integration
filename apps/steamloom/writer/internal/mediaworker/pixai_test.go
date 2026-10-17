package mediaworker

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
)

// fakePixAI 模擬 PixAI：只認 good-key，task 第一次輪詢 running、第二次 completed。
func fakePixAI(t *testing.T, created *map[string]any) *httptest.Server {
	var polls atomic.Int32
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/img.png" {
			if r.Header.Get("Authorization") != "" {
				t.Error("download must not forward the API key")
			}
			_ = png.Encode(w, image.NewRGBA(image.Rect(0, 0, 32, 48)))
			return
		}
		if r.Header.Get("Authorization") != "Bearer good-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch {
		case r.URL.Path == "/v1/task/0":
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"not found","code":40400000}`))
		case r.URL.Path == "/v2/image/create":
			_ = json.NewDecoder(r.Body).Decode(created)
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"t1","status":"waiting","outputs":{"mediaIds":[],"mediaUrls":[]}}`))
		case r.URL.Path == "/v1/task/t1":
			if polls.Add(1) == 1 {
				_, _ = w.Write([]byte(`{"id":"t1","status":"running"}`))
				return
			}
			_, _ = w.Write([]byte(`{"id":"t1","status":"completed","mediaSafetyLevel":"safe","outputs":{"mediaIds":["m1"],"mediaUrls":["` + server.URL + `/img.png"]}}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	return server
}

func TestPixAIDiscoverAndGenerate(t *testing.T) {
	var created map[string]any
	server := fakePixAI(t, &created)
	defer server.Close()
	adapter := pixaiAdapter{client: server.Client(), baseURL: server.URL, pollInterval: 0}
	if _, err := adapter.Discover(context.Background(), nil, map[string]string{"api_key": "bad"}); err == nil {
		t.Fatal("invalid key should fail discovery")
	}
	if _, err := adapter.Discover(context.Background(), nil, map[string]string{"api_key": "good-key"}); err != nil {
		t.Fatal(err)
	}
	// 常用模型排在最前面當預設；選了常用 LoRA 時，權重要沿用清單設定。
	settings := map[string]string{
		pixaiFavoriteModel: `[{"id":"custom-1","name":"Moonbeam","weight":0}]`,
		pixaiFavoriteLoRA:  `[{"id":"lora-1","name":"Detail","weight":0.7},{"id":"lora-2","name":"Unused","weight":1}]`,
	}
	inputs, err := validateJobInput(adapter.JobFields(settings), map[string]any{"prompt": "藍髮少女", "candidate_count": "4", "seed": 7.0, "prompt_helper": false, "mode": "", "loras": []any{"lora-1"}})
	if err != nil {
		t.Fatal(err)
	}
	if inputs["model_version_id"] != "custom-1" {
		t.Fatalf("favorite model should become the default: %#v", inputs)
	}
	root := t.TempDir()
	result, err := adapter.Generate(context.Background(), settings, map[string]string{"api_key": "good-key"}, inputs, root)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{"modelVersionId": "custom-1", "prompt": "藍髮少女", "aspectRatio": "1:1", "size": "1k", "batchSize": 4.0, "seed": 7.0, "promptHelper": "disable", "loras": []any{map[string]any{"modelId": "lora-1", "weight": 0.7}}}
	gotJSON, _ := json.Marshal(created)
	wantJSON, _ := json.Marshal(want)
	if !bytes.Equal(gotJSON, wantJSON) {
		t.Fatalf("create body = %s, want %s", gotJSON, wantJSON)
	}
	if len(result.Artifacts) != 1 {
		t.Fatalf("artifacts = %#v", result.Artifacts)
	}
	artifact := result.Artifacts[0]
	if artifact.MIMEType != "image/png" || artifact.Width != 32 || artifact.Height != 48 || artifact.ProviderJobID != "t1" || artifact.Parameters["media_safety_level"] != "safe" {
		t.Fatalf("artifact = %#v", artifact)
	}
	if _, err := os.Stat(artifact.LocalPath); err != nil {
		t.Fatal(err)
	}
}

// fakeModelPage 產生最小的 turbo-stream 模型頁：GenerationModel 物件帶 title、type、latestAvailableVersion。
func fakeModelPage(modelID, title, modelType, latest string) string {
	data := []any{
		map[string]any{"_1": 2, "_3": 4, "_5": 6, "_7": 8, "_9": 10},
		"__typename", "GenerationModel", "id", modelID, "title", title, "type", modelType,
		"latestAvailableVersion", map[string]any{"_3": 11}, latest,
	}
	raw, _ := json.Marshal(data)
	quoted, _ := json.Marshal(string(raw) + "\n")
	return `<html><script>window.__reactRouterContext.streamController.enqueue(` + string(quoted) + `);</script></html>`
}

func TestPixAIResolveCatalogItem(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/model/111":
			_, _ = w.Write([]byte(fakeModelPage("111", "Moonbeam", "SD_V1_MODEL", "112")))
		case "/model/222":
			_, _ = w.Write([]byte(fakeModelPage("222", "Detail Tweaker", "MULTI_LORA", "223")))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()
	adapter := pixaiAdapter{client: server.Client(), webURL: server.URL}
	ctx := context.Background()
	// 單一版本模型頁沒有 versionId：取最新可用版本，名稱用模型標題。
	if item, err := adapter.ResolveCatalogItem(ctx, pixaiFavoriteModel, "https://pixai.art/zh/model/111"); err != nil || item.ID != "112" || item.Name != "Moonbeam" {
		t.Fatalf("model without version = %#v, %v", item, err)
	}
	// 網址自帶版本時以網址為準；LoRA 預設權重 1。
	if item, err := adapter.ResolveCatalogItem(ctx, pixaiFavoriteLoRA, "https://pixai.art/model/222/999"); err != nil || item.ID != "999" || item.Weight != 1 {
		t.Fatalf("lora with version = %#v, %v", item, err)
	}
	// 貼錯區塊要擋下。
	if _, err := adapter.ResolveCatalogItem(ctx, pixaiFavoriteModel, "https://pixai.art/model/222"); err == nil {
		t.Fatal("LoRA pasted into favorite models should fail")
	}
	// 頁面讀不到：有版本就用預設名稱，沒有版本才失敗。
	if item, err := adapter.ResolveCatalogItem(ctx, pixaiFavoriteModel, "https://pixai.art/model/333/123456789"); err != nil || item.Name != "模型 456789" {
		t.Fatalf("fallback name = %#v, %v", item, err)
	}
	if _, err := adapter.ResolveCatalogItem(ctx, pixaiFavoriteModel, "https://pixai.art/model/333"); err == nil {
		t.Fatal("unreadable page without version should fail")
	}
	if _, err := adapter.ResolveCatalogItem(ctx, pixaiFavoriteModel, "https://example.com/model/1"); err == nil {
		t.Fatal("non-PixAI URL should fail")
	}
}

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
	inputs, err := validateJobInput(adapter.JobFields(map[string]string{"model_version_id": "custom-1"}), map[string]any{"prompt": "藍髮少女", "candidate_count": "4", "seed": 7.0, "prompt_helper": false, "mode": ""})
	if err != nil {
		t.Fatal(err)
	}
	if inputs["model_version_id"] != "custom-1" {
		t.Fatalf("custom model should become the default: %#v", inputs)
	}
	root := t.TempDir()
	result, err := adapter.Generate(context.Background(), nil, map[string]string{"api_key": "good-key"}, inputs, root)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{"modelVersionId": "custom-1", "prompt": "藍髮少女", "aspectRatio": "1:1", "size": "1k", "batchSize": 4.0, "seed": 7.0, "promptHelper": "disable"}
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

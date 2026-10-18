package mediaworker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"
)

func TestFalDiscoverAndGenerate(t *testing.T) {
	var submitted map[string]any
	var polls atomic.Int32
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/image.png" {
			if r.Header.Get("Authorization") != "" {
				t.Error("download must not forward the API key")
			}
			_ = png.Encode(w, image.NewRGBA(image.Rect(0, 0, 40, 60)))
			return
		}
		if r.Header.Get("Authorization") != "Key good-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch {
		case r.URL.Path == "/fal-ai/flux/dev/requests/00000000-0000-0000-0000-000000000000/status":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == http.MethodPost && r.URL.Path == "/fal-ai/flux/dev":
			_ = json.NewDecoder(r.Body).Decode(&submitted)
			_, _ = w.Write([]byte(`{"request_id":"req-1"}`))
		case r.URL.Path == "/fal-ai/flux/dev/requests/req-1/status":
			if r.URL.Query().Get("logs") != "1" {
				t.Error("status request should include logs=1")
			}
			if polls.Add(1) == 1 {
				_, _ = w.Write([]byte(`{"status":"IN_QUEUE"}`))
				return
			}
			_, _ = w.Write([]byte(`{"status":"COMPLETED"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/fal-ai/flux/dev/requests/req-1":
			_, _ = w.Write([]byte(`{"images":[{"url":"` + server.URL + `/image.png","width":40,"height":60,"content_type":"image/png"},{"url":"` + server.URL + `/image.png","width":40,"height":60,"content_type":"image/png"}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	adapter := falAdapter{client: server.Client(), queueURL: server.URL, pollInterval: 0}
	if _, err := adapter.Discover(context.Background(), nil, map[string]string{"api_key": "bad"}); err == nil {
		t.Fatal("invalid key should fail discovery")
	}
	if discovery, err := adapter.Discover(context.Background(), nil, map[string]string{"api_key": "good-key"}); err != nil || len(discovery.Capabilities) != 2 {
		t.Fatalf("discovery = %#v, err = %v", discovery, err)
	}
	inputs, err := validateJobInput(adapter.JobFields(nil), map[string]any{"prompt": "blue-haired heroine", "candidate_count": 2, "seed": 7})
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	result, err := adapter.Generate(context.Background(), nil, map[string]string{"api_key": "good-key"}, inputs, root)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"prompt": "blue-haired heroine", "image_size": "landscape_4_3", "num_images": 2.0,
		"num_inference_steps": 28.0, "guidance_scale": 3.5, "seed": 7.0,
		"acceleration": "none", "output_format": "jpeg", "enable_safety_checker": true,
	}
	gotJSON, _ := json.Marshal(submitted)
	wantJSON, _ := json.Marshal(want)
	if !bytes.Equal(gotJSON, wantJSON) {
		t.Fatalf("submit body = %s, want %s", gotJSON, wantJSON)
	}
	if len(result.Artifacts) != 2 {
		t.Fatalf("artifacts = %#v", result.Artifacts)
	}
	for index, artifact := range result.Artifacts {
		if artifact.ProviderJobID != "req-1" || artifact.Model != falFluxDev || artifact.Width != 40 || artifact.Height != 60 || artifact.FileName != fmt.Sprintf("fal-candidate-%d.png", index+1) {
			t.Fatalf("artifact %d = %#v", index, artifact)
		}
		if _, err := os.Stat(artifact.LocalPath); err != nil {
			t.Fatal(err)
		}
	}
}

func TestFalCancelsRemoteRequest(t *testing.T) {
	polled, cancelled := make(chan struct{}), make(chan struct{})
	var polledOnce, cancelledOnce atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/fal-ai/flux/dev":
			_, _ = w.Write([]byte(`{"request_id":"req-cancel"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/fal-ai/flux/dev/requests/req-cancel/status":
			if polledOnce.CompareAndSwap(false, true) {
				close(polled)
			}
			_, _ = w.Write([]byte(`{"status":"IN_PROGRESS"}`))
		case r.Method == http.MethodPut && r.URL.Path == "/fal-ai/flux/dev/requests/req-cancel/cancel":
			if cancelledOnce.CompareAndSwap(false, true) {
				close(cancelled)
			}
			_, _ = w.Write([]byte(`{"status":"CANCELLATION_REQUESTED"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	adapter := falAdapter{client: server.Client(), queueURL: server.URL, pollInterval: time.Second}
	inputs, err := validateJobInput(adapter.JobFields(nil), map[string]any{"prompt": "cancel me"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	root := t.TempDir()
	go func() {
		_, err := adapter.Generate(ctx, nil, map[string]string{"api_key": "good-key"}, inputs, root)
		done <- err
	}()
	select {
	case <-polled:
		cancel()
	case <-time.After(time.Second):
		t.Fatal("fal status was not polled")
	}
	if err := <-done; err == nil {
		t.Fatal("cancelled generation should fail")
	}
	select {
	case <-cancelled:
	case <-time.After(time.Second):
		t.Fatal("fal cancel endpoint was not called")
	}
}

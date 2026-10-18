package mediaworker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

const onePixelPNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func TestStableDiffusionWebUIDiscoverAndGenerate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		username, password, ok := request.BasicAuth()
		if !ok || username != "writer" || password != "secret" {
			t.Errorf("basic auth = %q, %q, %v", username, password, ok)
		}
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/sdapi/v1/options":
			_, _ = writer.Write([]byte(`{"sd_model_checkpoint":"model.safetensors"}`))
		case "/sdapi/v1/sd-models":
			_, _ = writer.Write([]byte(`[{"title":"Model","model_name":"model"}]`))
		case "/sdapi/v1/samplers":
			_, _ = writer.Write([]byte(`[{"name":"Euler a"}]`))
		case "/sdapi/v1/txt2img":
			var payload map[string]any
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				t.Error(err)
			}
			if payload["batch_size"] != float64(2) || payload["prompt"] != "blue-haired heroine" {
				t.Errorf("payload = %#v", payload)
			}
			if payload["override_settings"].(map[string]any)["sd_model_checkpoint"] != "model.safetensors" {
				t.Errorf("override settings = %#v", payload["override_settings"])
			}
			_ = json.NewEncoder(writer).Encode(map[string]any{"images": []string{onePixelPNG, onePixelPNG}})
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	adapter := NewStableDiffusionWebUIAdapter(server.Client()).(stableDiffusionWebUIAdapter)
	settings := map[string]string{"endpoint": server.URL, "username": "writer", "default_checkpoint": "model.safetensors", "default_sampler": "Euler a"}
	secrets := map[string]string{"password": "secret"}
	discovery, err := adapter.Discover(context.Background(), settings, secrets)
	if err != nil || len(discovery.Capabilities) != 2 {
		t.Fatalf("discovery = %#v, err = %v", discovery, err)
	}
	inputs, err := validateJobInput(adapter.JobFields(settings), map[string]any{"prompt": "blue-haired heroine", "candidate_count": 2})
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	result, err := adapter.Generate(context.Background(), settings, secrets, inputs, root)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Artifacts) != 2 || result.Artifacts[0].Width != 512 || result.Artifacts[0].Height != 512 {
		t.Fatalf("artifacts = %#v", result.Artifacts)
	}
	for _, artifact := range result.Artifacts {
		if _, err := os.Stat(artifact.LocalPath); err != nil {
			t.Fatal(err)
		}
	}
}

func TestStableDiffusionWebUIRejectsUnavailableAPI(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	defer server.Close()
	adapter := NewStableDiffusionWebUIAdapter(server.Client())
	if _, err := adapter.Discover(context.Background(), map[string]string{"endpoint": server.URL}, nil); err == nil {
		t.Fatal("disabled WebUI API should fail discovery")
	}
}

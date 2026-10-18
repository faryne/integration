package mediaworker

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func jsonClient(t *testing.T, check func(*http.Request), body string) *http.Client {
	t.Helper()
	return &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		check(request)
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
	})}
}

func TestRegistryRejectsDuplicateAdapter(t *testing.T) {
	client := &http.Client{}
	if _, err := NewRegistry(NewComfyUIAdapter(client), NewComfyUIAdapter(client)); err == nil {
		t.Fatal("duplicate adapter should fail")
	}
}

func TestComfyUIDiscoversCapabilities(t *testing.T) {
	client := jsonClient(t, func(r *http.Request) {
		if r.URL.Path != "/object_info" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}, `{"KSampler":{},"CLIPTextEncode":{},"CheckpointLoaderSimple":{},"LoadImage":{},"VAEEncode":{},"LoraLoader":{}}`)
	discovery, err := NewComfyUIAdapter(client).Discover(context.Background(), map[string]string{"endpoint": "http://worker.test"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(discovery.Capabilities) != 4 {
		t.Fatalf("capabilities = %v", discovery.Capabilities)
	}
}

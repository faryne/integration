package mediaworker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type httpAdapter struct {
	descriptor AdapterDescriptor
	discover   func(context.Context, *http.Client, map[string]string, map[string]string) (Discovery, error)
	client     *http.Client
}

func (a httpAdapter) Descriptor() AdapterDescriptor { return a.descriptor }
func (a httpAdapter) Discover(ctx context.Context, settings, secrets map[string]string) (Discovery, error) {
	return a.discover(ctx, a.client, settings, secrets)
}

// NewComfyUIAdapter 透過 object_info 偵測節點，不在設定階段送出生成工作。
func NewComfyUIAdapter(client *http.Client) Adapter {
	return httpAdapter{
		client: client,
		descriptor: AdapterDescriptor{
			ID: "comfyui", Name: "ComfyUI", Description: "連接本機或自管的 ComfyUI 服務", MediaTypes: []string{"image"},
			Fields: []SettingField{{Key: "endpoint", Label: "服務位址", Kind: "url", Required: true, Placeholder: "http://127.0.0.1:8188"}},
		},
		discover: discoverComfyUI,
	}
}

func discoverComfyUI(ctx context.Context, client *http.Client, settings, _ map[string]string) (Discovery, error) {
	base, err := endpoint(settings["endpoint"])
	if err != nil {
		return Discovery{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/object_info", nil)
	if err != nil {
		return Discovery{}, err
	}
	var nodes map[string]json.RawMessage
	if err := fetchJSON(client, req, &nodes); err != nil {
		return Discovery{}, err
	}
	capabilities := []string{}
	if hasNodes(nodes, "KSampler", "CLIPTextEncode", "CheckpointLoaderSimple") {
		capabilities = append(capabilities, "text_to_image")
	}
	if hasNodes(nodes, "LoadImage", "VAEEncode") {
		capabilities = append(capabilities, "image_to_image", "reference_image")
	}
	if _, ok := nodes["LoraLoader"]; ok {
		capabilities = append(capabilities, "lora")
	}
	if len(capabilities) == 0 {
		return Discovery{}, errors.New("已連上 ComfyUI，但找不到可支援的生圖節點")
	}
	return Discovery{Capabilities: capabilities, Message: "已連上 ComfyUI"}, nil
}

func endpoint(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("請輸入有效的 http/https 服務位址")
	}
	return parsed.String(), nil
}

func fetchJSON(client *http.Client, req *http.Request, target any) error {
	response, err := client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("Worker 回傳 HTTP %d", response.StatusCode)
	}
	return json.NewDecoder(response.Body).Decode(target)
}

func hasNodes(nodes map[string]json.RawMessage, names ...string) bool {
	for _, name := range names {
		if _, ok := nodes[name]; !ok {
			return false
		}
	}
	return true
}

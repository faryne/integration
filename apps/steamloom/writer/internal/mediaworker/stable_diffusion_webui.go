package mediaworker

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const stableDiffusionWebUIMaxWait = 10 * time.Minute

type stableDiffusionWebUIAdapter struct{ client *http.Client }

type stableDiffusionWebUIModel struct {
	Title     string `json:"title"`
	ModelName string `json:"model_name"`
}

type stableDiffusionWebUISampler struct {
	Name string `json:"name"`
}

type stableDiffusionWebUIResponse struct {
	Images []string `json:"images"`
}

// NewStableDiffusionWebUIAdapter 支援共用 sdapi/v1 contract 的 AUTOMATIC1111 與 Forge。
func NewStableDiffusionWebUIAdapter(client *http.Client) Adapter {
	if client == nil {
		client = &http.Client{Timeout: stableDiffusionWebUIMaxWait}
	}
	return stableDiffusionWebUIAdapter{client: client}
}

func (stableDiffusionWebUIAdapter) Descriptor() AdapterDescriptor {
	return AdapterDescriptor{
		ID: "stable-diffusion-webui", Name: "Stable Diffusion WebUI（A1111／Forge）",
		Description: "連接啟用 API 的 AUTOMATIC1111 或 Forge 服務", MediaTypes: []string{"image"},
		Fields: []SettingField{
			{Key: "endpoint", Label: "服務位址", Kind: "url", Required: true, Placeholder: "http://127.0.0.1:7860"},
			{Key: "username", Label: "API Auth 使用者名稱", Kind: "text", Placeholder: "未啟用 --api-auth 時留白"},
			{Key: "password", Label: "API Auth 密碼", Kind: "password", Secret: true},
			{Key: "default_checkpoint", Label: "預設 Checkpoint", Kind: "text", Placeholder: "留白時沿用 WebUI 目前模型"},
			{Key: "default_sampler", Label: "預設 Sampler", Kind: "text", Default: "Euler a"},
		},
	}
}

func (stableDiffusionWebUIAdapter) Capabilities(map[string]string) []string {
	return []string{"text_to_image", "batch_candidates"}
}

func (a stableDiffusionWebUIAdapter) Discover(ctx context.Context, settings, secrets map[string]string) (Discovery, error) {
	var options map[string]any
	if err := a.get(ctx, settings, secrets, "/sdapi/v1/options", &options); err != nil {
		return Discovery{}, err
	}
	var models []stableDiffusionWebUIModel
	if err := a.get(ctx, settings, secrets, "/sdapi/v1/sd-models", &models); err != nil {
		return Discovery{}, err
	}
	var samplers []stableDiffusionWebUISampler
	if err := a.get(ctx, settings, secrets, "/sdapi/v1/samplers", &samplers); err != nil {
		return Discovery{}, err
	}
	if len(models) == 0 || len(samplers) == 0 {
		return Discovery{}, errors.New("已連上 Stable Diffusion WebUI，但找不到 Checkpoint 或 Sampler")
	}
	return Discovery{
		Capabilities: a.Capabilities(settings),
		Message:      fmt.Sprintf("已連上 Stable Diffusion WebUI（%d 個 Checkpoint、%d 個 Sampler）", len(models), len(samplers)),
	}, nil
}

func (stableDiffusionWebUIAdapter) JobFields(settings map[string]string) []JobField {
	return []JobField{
		{Key: "prompt", Label: "Prompt", Kind: "textarea", Required: true},
		{Key: "negative_prompt", Label: "Negative prompt", Kind: "textarea"},
		{Key: "checkpoint", Label: "Checkpoint", Kind: "text", Description: "留白時沿用 WebUI 目前模型", Default: strings.TrimSpace(settings["default_checkpoint"])},
		{Key: "sampler_name", Label: "Sampler", Kind: "text", Required: true, Default: fallback(settings["default_sampler"], "Euler a")},
		{Key: "steps", Label: "Steps", Kind: "number", Default: 20, Min: number(1), Max: number(150), Step: number(1)},
		{Key: "cfg_scale", Label: "CFG Scale", Kind: "number", Default: 7, Min: number(1), Max: number(30), Step: number(0.5)},
		{Key: "width", Label: "Width", Kind: "number", Default: 512, Min: number(64), Max: number(2048), Step: number(64)},
		{Key: "height", Label: "Height", Kind: "number", Default: 512, Min: number(64), Max: number(2048), Step: number(64)},
		{Key: "candidate_count", Label: "候選張數", Kind: "number", Default: 1, Min: number(1), Max: number(4), Step: number(1)},
		{Key: "seed", Label: "Seed", Kind: "number", Description: "留白代表隨機", Min: number(-1), Max: number(2147483647), Step: number(1)},
		{Key: "restore_faces", Label: "Restore faces", Kind: "boolean", Default: false},
		{Key: "tiling", Label: "Tiling", Kind: "boolean", Default: false},
	}
}

func (a stableDiffusionWebUIAdapter) Generate(ctx context.Context, settings, secrets map[string]string, inputs map[string]any, root string) (GenerateResult, error) {
	ctx, cancel := context.WithTimeout(ctx, stableDiffusionWebUIMaxWait)
	defer cancel()
	payload := map[string]any{
		"prompt": textInput(inputs, "prompt"), "negative_prompt": textInput(inputs, "negative_prompt"),
		"sampler_name": inputs["sampler_name"], "steps": int(inputs["steps"].(float64)), "cfg_scale": inputs["cfg_scale"],
		"width": int(inputs["width"].(float64)), "height": int(inputs["height"].(float64)), "batch_size": int(inputs["candidate_count"].(float64)), "n_iter": 1,
		"seed": -1, "restore_faces": inputs["restore_faces"], "tiling": inputs["tiling"], "send_images": true, "save_images": false,
	}
	if seed, exists := inputs["seed"]; exists {
		payload["seed"] = int(seed.(float64))
	}
	if checkpoint := textInput(inputs, "checkpoint"); checkpoint != "" {
		payload["override_settings"] = map[string]any{"sd_model_checkpoint": checkpoint}
		payload["override_settings_restore_afterwards"] = true
	}
	audit := auditRequest("stable-diffusion-webui", http.MethodPost, strings.TrimRight(settings["endpoint"], "/")+"/sdapi/v1/txt2img", payload)
	var response stableDiffusionWebUIResponse
	if err := a.post(ctx, settings, secrets, "/sdapi/v1/txt2img", payload, &response); err != nil {
		return GenerateResult{Request: audit}, err
	}
	if len(response.Images) == 0 {
		return GenerateResult{Request: audit}, errors.New("Stable Diffusion WebUI 沒有回傳圖片")
	}
	result := GenerateResult{Root: root, Artifacts: make([]GeneratedArtifact, 0, len(response.Images)), Request: audit}
	for index, encoded := range response.Images {
		artifact, err := saveStableDiffusionImage(root, index, encoded, inputs)
		if err != nil {
			return GenerateResult{Request: audit}, err
		}
		result.Artifacts = append(result.Artifacts, artifact)
	}
	return result, nil
}

func (a stableDiffusionWebUIAdapter) get(ctx context.Context, settings, secrets map[string]string, path string, target any) error {
	return a.call(ctx, settings, secrets, http.MethodGet, path, nil, target)
}

func (a stableDiffusionWebUIAdapter) post(ctx context.Context, settings, secrets map[string]string, path string, payload, target any) error {
	return a.call(ctx, settings, secrets, http.MethodPost, path, payload, target)
}

func (a stableDiffusionWebUIAdapter) call(ctx context.Context, settings, secrets map[string]string, method, path string, payload, target any) error {
	base, err := endpoint(settings["endpoint"])
	if err != nil {
		return err
	}
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(raw)
	}
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(base, "/")+path, body)
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if username := strings.TrimSpace(settings["username"]); username != "" {
		request.SetBasicAuth(username, secrets["password"])
	}
	response, err := a.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 512))
		return fmt.Errorf("Stable Diffusion WebUI 回傳 HTTP %d：%s", response.StatusCode, strings.TrimSpace(string(message)))
	}
	return json.NewDecoder(response.Body).Decode(target)
}

func saveStableDiffusionImage(root string, index int, encoded string, inputs map[string]any) (GeneratedArtifact, error) {
	if separator := strings.IndexByte(encoded, ','); strings.HasPrefix(encoded, "data:") && separator >= 0 {
		encoded = encoded[separator+1:]
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return GeneratedArtifact{}, fmt.Errorf("Stable Diffusion WebUI 圖片不是有效的 base64：%w", err)
	}
	mimeType := http.DetectContentType(raw)
	extension := map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}[mimeType]
	if extension == "" {
		return GeneratedArtifact{}, fmt.Errorf("Stable Diffusion WebUI 回傳不支援的圖片格式：%s", mimeType)
	}
	name := fmt.Sprintf("sd-webui-candidate-%d%s", index+1, extension)
	path := filepath.Join(root, name)
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return GeneratedArtifact{}, err
	}
	return GeneratedArtifact{
		LocalPath: path, FileName: name, MIMEType: mimeType, Model: textInput(inputs, "checkpoint"),
		Parameters: cloneAnyMap(inputs), CandidateGroup: "sd-webui", Width: int(inputs["width"].(float64)), Height: int(inputs["height"].(float64)),
	}, nil
}

func fallback(value, defaultValue string) string {
	if value = strings.TrimSpace(value); value != "" {
		return value
	}
	return defaultValue
}

func textInput(inputs map[string]any, key string) string {
	value, _ := inputs[key].(string)
	return strings.TrimSpace(value)
}

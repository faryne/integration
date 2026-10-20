package mediaworker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

const (
	falQueueURL    = "https://queue.fal.run"
	falFluxDev     = "fal-ai/flux/dev"
	falMaxWait     = 15 * time.Minute
	falMaxDownload = 64 << 20
)

type falAdapter struct {
	client       *http.Client
	queueURL     string
	pollInterval time.Duration
}

// NewFalAdapter 使用 fal 非同步 Queue API；第一版只開放 Writer 已驗證 schema 的 FLUX.1 [dev]。
func NewFalAdapter(client *http.Client) Adapter {
	if client == nil {
		client = http.DefaultClient
	}
	return falAdapter{client: client, queueURL: falQueueURL, pollInterval: 2 * time.Second}
}

func (falAdapter) Descriptor() AdapterDescriptor {
	return AdapterDescriptor{
		ID: "fal", Name: "fal", Description: "使用 fal Queue API 生成圖片（會消耗 fal 額度）", MediaTypes: []string{"image"},
		Fields: []SettingField{{Key: "api_key", Label: "API Key", Kind: "password", Required: true, Secret: true}},
	}
}

func (falAdapter) Capabilities(map[string]string) []string {
	return []string{"text_to_image", "batch_candidates"}
}

// Discover 查詢不存在的 request 驗證 key，不送出推論工作也不消耗額度。
func (a falAdapter) Discover(ctx context.Context, _, secrets map[string]string) (Discovery, error) {
	key := strings.TrimSpace(secrets["api_key"])
	if key == "" {
		return Discovery{}, errors.New("請先填入 fal API Key")
	}
	path := "/" + falFluxDev + "/requests/00000000-0000-0000-0000-000000000000/status"
	status, body, err := a.call(ctx, http.MethodGet, path, key, nil)
	if err != nil {
		return Discovery{}, err
	}
	switch status {
	case http.StatusOK, http.StatusNotFound:
		return Discovery{Capabilities: a.Capabilities(nil), Message: "fal API Key 驗證成功"}, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return Discovery{}, errors.New("fal API Key 無效或已被撤銷")
	default:
		return Discovery{}, falError(status, body)
	}
}

func (falAdapter) JobFields(map[string]string) []JobField {
	return []JobField{
		{Key: "model", Label: "模型", Kind: "select", Required: true, Default: falFluxDev, Options: []JobOption{{Value: falFluxDev, Label: "FLUX.1 [dev]"}}},
		{Key: "prompt", Label: "Prompt", Kind: "textarea", Required: true},
		{Key: "aspect_ratio", Label: "長寬比", Kind: "select", Default: "landscape_4_3", Options: []JobOption{
			{Value: "square_hd", Label: "1:1（HD）"}, {Value: "square", Label: "1:1"},
			{Value: "portrait_4_3", Label: "3:4"}, {Value: "portrait_16_9", Label: "9:16"},
			{Value: "landscape_4_3", Label: "4:3"}, {Value: "landscape_16_9", Label: "16:9"},
		}},
		{Key: "candidate_count", Label: "候選張數", Kind: "number", Default: 1, Min: number(1), Max: number(4), Step: number(1)},
		{Key: "num_inference_steps", Label: "推論步數", Kind: "number", Default: 28, Min: number(1), Max: number(50), Step: number(1)},
		{Key: "guidance_scale", Label: "Guidance scale", Kind: "number", Default: 3.5, Min: number(1), Max: number(20), Step: number(0.1)},
		{Key: "seed", Label: "Seed", Kind: "number", Description: "留空代表隨機", Min: number(0), Max: number(2147483647), Step: number(1)},
		{Key: "acceleration", Label: "加速模式", Kind: "select", Default: "none", Options: []JobOption{{Value: "none", Label: "None"}, {Value: "regular", Label: "Regular"}, {Value: "high", Label: "High"}}},
		{Key: "output_format", Label: "輸出格式", Kind: "select", Default: "jpeg", Options: []JobOption{{Value: "jpeg", Label: "JPEG"}, {Value: "png", Label: "PNG"}}},
		{Key: "enable_safety_checker", Label: "啟用安全檢查", Kind: "boolean", Default: true},
	}
}

type falQueueStatus struct {
	Status    string          `json:"status"`
	Error     json.RawMessage `json:"error"`
	ErrorType string          `json:"error_type"`
}

type falResult struct {
	Images []struct {
		URL         string `json:"url"`
		Width       int    `json:"width"`
		Height      int    `json:"height"`
		ContentType string `json:"content_type"`
	} `json:"images"`
}

// Generate 走 queue submit → status → result，成功後立刻把暫時 URL 下載到 Writer staging 目錄。
func (a falAdapter) Generate(ctx context.Context, _ map[string]string, secrets map[string]string, inputs map[string]any, root string) (result GenerateResult, err error) {
	key := strings.TrimSpace(secrets["api_key"])
	if key == "" {
		return GenerateResult{}, errors.New("fal API Key 已不存在，請到設定頁重新填寫")
	}
	model := fmt.Sprint(inputs["model"])
	if model != falFluxDev {
		return GenerateResult{}, errors.New("fal 模型不在 Writer 支援清單")
	}
	request := map[string]any{
		"prompt": inputs["prompt"], "image_size": inputs["aspect_ratio"], "num_images": int(inputs["candidate_count"].(float64)),
		"num_inference_steps": int(inputs["num_inference_steps"].(float64)), "guidance_scale": inputs["guidance_scale"],
		"acceleration": inputs["acceleration"], "output_format": inputs["output_format"], "enable_safety_checker": inputs["enable_safety_checker"],
	}
	if seed, ok := inputs["seed"].(float64); ok {
		request["seed"] = int64(seed)
	}
	audit := auditRequest("fal", http.MethodPost, a.queueURL+"/"+model, request)
	result = GenerateResult{Request: audit}
	ctx, cancel := context.WithTimeout(ctx, falMaxWait)
	defer cancel()
	status, body, err := a.call(ctx, http.MethodPost, "/"+model, key, request)
	if err != nil {
		return result, err
	}
	if status < 200 || status >= 300 {
		return result, falError(status, body)
	}
	var submitted struct {
		RequestID string `json:"request_id"`
	}
	if json.Unmarshal(body, &submitted) != nil || submitted.RequestID == "" {
		return result, errors.New("fal 回傳無法解析的 request 資料")
	}
	requestPath := "/" + model + "/requests/" + submitted.RequestID
	// Writer 中斷等待時同步要求 fal 取消；取消失敗不覆蓋原本的 context 錯誤。
	defer func() {
		if ctx.Err() != nil {
			a.cancel(requestPath, key)
		}
	}()

	for {
		queue, queueErr := a.status(ctx, requestPath, key)
		if queueErr != nil {
			return result, queueErr
		}
		switch queue.Status {
		case "COMPLETED":
			if len(queue.Error) > 0 && string(queue.Error) != "null" {
				return result, fmt.Errorf("fal 推論失敗%s：%s", falErrorType(queue.ErrorType), falErrorText(queue.Error))
			}
			goto completed
		case "IN_QUEUE", "IN_PROGRESS":
		case "FAILED", "CANCELLED":
			return result, fmt.Errorf("fal request %s 結束狀態為 %s", submitted.RequestID, queue.Status)
		default:
			return result, fmt.Errorf("fal request %s 回傳未知狀態 %q", submitted.RequestID, queue.Status)
		}
		select {
		case <-ctx.Done():
			return result, fmt.Errorf("已停止等待 fal request %s：%w", submitted.RequestID, ctx.Err())
		case <-time.After(a.pollInterval):
		}
	}

completed:
	status, body, err = a.call(ctx, http.MethodGet, requestPath, key, nil)
	if err != nil {
		return result, err
	}
	if status < 200 || status >= 300 {
		return result, falError(status, body)
	}
	var output falResult
	if json.Unmarshal(body, &output) != nil || len(output.Images) == 0 {
		return result, fmt.Errorf("fal request %s 完成但沒有回傳圖片", submitted.RequestID)
	}
	result = GenerateResult{Root: root, Artifacts: make([]GeneratedArtifact, 0, len(output.Images)), Request: audit}
	for index, image := range output.Images {
		artifact, downloadErr := downloadImage(ctx, a.client, image.URL, filepath.Join(root, fmt.Sprintf("fal-candidate-%d", index+1)), falMaxDownload)
		if downloadErr != nil {
			return result, fmt.Errorf("下載 fal 第 %d 張圖片失敗：%w", index+1, downloadErr)
		}
		// fal metadata 尺寸可補足 WebP 無 decoder 的情況；實際內容格式仍以下載結果偵測。
		if artifact.Width == 0 || artifact.Height == 0 {
			artifact.Width, artifact.Height = image.Width, image.Height
		}
		artifact.ProviderJobID, artifact.Model, artifact.Parameters, artifact.CandidateGroup = submitted.RequestID, model, cloneAnyMap(inputs), "fal-"+submitted.RequestID
		result.Artifacts = append(result.Artifacts, artifact)
	}
	return result, nil
}

func (a falAdapter) status(ctx context.Context, requestPath, key string) (falQueueStatus, error) {
	status, body, err := a.call(ctx, http.MethodGet, requestPath+"/status?logs=1", key, nil)
	if err != nil {
		return falQueueStatus{}, err
	}
	if status < 200 || status >= 300 {
		return falQueueStatus{}, falError(status, body)
	}
	var queue falQueueStatus
	if json.Unmarshal(body, &queue) != nil || queue.Status == "" {
		return falQueueStatus{}, errors.New("fal 回傳無法解析的 queue 狀態")
	}
	return queue, nil
}

func (a falAdapter) cancel(requestPath, key string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _, _ = a.call(ctx, http.MethodPut, requestPath+"/cancel", key, nil)
}

func (a falAdapter) call(ctx context.Context, method, path, key string, payload any) (int, []byte, error) {
	var reader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return 0, nil, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(a.queueURL, "/")+path, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Key "+key)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := a.client.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("無法連線 fal：%w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	return response.StatusCode, body, err
}

func falError(status int, body []byte) error {
	var payload struct {
		Message string `json:"message"`
		Detail  any    `json:"detail"`
	}
	if json.Unmarshal(body, &payload) == nil {
		if payload.Message != "" {
			return fmt.Errorf("fal 回傳 HTTP %d：%s", status, payload.Message)
		}
		if payload.Detail != nil {
			return fmt.Errorf("fal 回傳 HTTP %d：%v", status, payload.Detail)
		}
	}
	return fmt.Errorf("fal 回傳 HTTP %d", status)
}

func falErrorText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	return strings.TrimSpace(string(raw))
}

func falErrorType(value string) string {
	if value == "" {
		return ""
	}
	return "（" + value + "）"
}

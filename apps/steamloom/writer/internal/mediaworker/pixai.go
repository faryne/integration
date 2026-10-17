package mediaworker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	pixaiBaseURL = "https://api.pixai.art"
	// pixaiDefaultModel 是官方推薦的 Tsubaki.2；mode 參數只有 Tsubaki 系列接受。
	pixaiDefaultModel = "1983308862240288769"
	// pixaiMaxWait 是單次生成的等待上限；apply 流程本身沒有逾時，由 adapter 自己收斂。
	pixaiMaxWait     = 10 * time.Minute
	pixaiMaxDownload = 30 << 20
)

// pixaiModels 是官方 Models 頁列出的推薦模型；作者可在設定填入其他 modelVersionId 補進選單。
var pixaiModels = []JobOption{
	{Value: pixaiDefaultModel, Label: "Tsubaki.2"},
	{Value: "1861558740588989558", Label: "Haruka v2"},
	{Value: "1954632828118619567", Label: "Hoshino v2"},
}

// pixaiImageTypes 對齊 asset.upload 可接受的格式；其他格式直接視為失敗，避免進 staging 才被拒。
var pixaiImageTypes = map[string]string{"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}

type pixaiAdapter struct {
	client       *http.Client
	baseURL      string
	webURL       string
	pollInterval time.Duration
}

// NewPixAIAdapter 串接 PixAI REST API（v2 建立工作、v1 輪詢 task）；API key 只存在 OS Keychain。
func NewPixAIAdapter(client *http.Client) Adapter {
	// PixAI 文件要求輪詢間隔不得短於 1.5 秒。
	return pixaiAdapter{client: client, baseURL: pixaiBaseURL, webURL: pixaiWebURL, pollInterval: 2 * time.Second}
}

func (pixaiAdapter) Descriptor() AdapterDescriptor {
	return AdapterDescriptor{
		ID: "pixai", Name: "PixAI", Description: "使用 PixAI API 生成動漫風格插圖（會消耗 PixAI 額度）", MediaTypes: []string{"image"},
		Fields: []SettingField{
			{Key: "api_key", Label: "API Key", Kind: "password", Required: true, Secret: true},
			// 常用清單：貼 pixai.art 模型網址加入，由 ResolveCatalogItem 解析版本與名稱（pixai_catalog.go）。
			{Key: pixaiFavoriteModel, Label: "常用模型", Kind: "catalog", Placeholder: "貼上 PixAI 模型網址"},
			{Key: pixaiFavoriteLoRA, Label: "常用 LoRA", Kind: "catalog", Placeholder: "貼上 PixAI LoRA 網址", ItemWeight: true},
		},
	}
}

// Discover 以查詢不存在的 task 驗證 API key：有效 key 回 404、無效 key 回 401，不會送出生成工作或扣額度。
func (a pixaiAdapter) Discover(ctx context.Context, settings, secrets map[string]string) (Discovery, error) {
	key := strings.TrimSpace(secrets["api_key"])
	if key == "" {
		return Discovery{}, errors.New("請先填入 PixAI API Key")
	}
	// 未帶 Authorization 時 PixAI 也回 404，所以一定要先確認有 key 才能用 404 判斷成功。
	status, body, err := a.call(ctx, http.MethodGet, "/v1/task/0", key, nil)
	if err != nil {
		return Discovery{}, err
	}
	switch status {
	case http.StatusNotFound, http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return Discovery{}, errors.New("PixAI API Key 無效或已被撤銷")
	default:
		return Discovery{}, pixaiError(status, body)
	}
	capabilities := []string{"text_to_image", "batch_candidates"}
	if len(pixaiFavorites(settings, pixaiFavoriteLoRA)) > 0 {
		capabilities = append(capabilities, "lora")
	}
	return Discovery{Capabilities: capabilities, Message: "PixAI API Key 驗證成功"}, nil
}

// JobFields 的模型選單是「常用模型＋官方推薦」（去重，第一個為預設）；有常用 LoRA 才出現 LoRA 多選。
func (pixaiAdapter) JobFields(settings map[string]string) []JobField {
	models := []JobOption{}
	for _, item := range pixaiFavorites(settings, pixaiFavoriteModel) {
		models = append(models, JobOption{Value: item.ID, Label: item.Name})
	}
	for _, option := range pixaiModels {
		if !optionExists(models, option.Value) {
			models = append(models, option)
		}
	}
	loras := []JobOption{}
	for _, item := range pixaiFavorites(settings, pixaiFavoriteLoRA) {
		loras = append(loras, JobOption{Value: item.ID, Label: fmt.Sprintf("%s · %g", item.Name, item.Weight)})
	}
	ratios := []JobOption{}
	for _, ratio := range []string{"1:1", "2:3", "3:2", "3:4", "4:3", "3:5", "5:3", "9:16", "16:9", "1:3", "3:1"} {
		ratios = append(ratios, JobOption{Value: ratio, Label: ratio})
	}
	fields := []JobField{
		{Key: "prompt", Label: "Prompt", Kind: "textarea", Required: true},
		{Key: "negative_prompt", Label: "Negative prompt", Kind: "textarea"},
		{Key: "model_version_id", Label: "模型", Kind: "select", Required: true, Default: models[0].Value, Options: models},
	}
	if len(loras) > 0 {
		// PixAI 一次最多 5 個 LoRA；權重沿用常用清單的設定。
		fields = append(fields, JobField{Key: "loras", Label: "LoRA", Kind: "multiselect", Max: number(5), Options: loras})
	}
	return append(fields, []JobField{
		{Key: "aspect_ratio", Label: "長寬比", Kind: "select", Default: "1:1", Options: ratios},
		{Key: "size", Label: "解析度", Kind: "select", Default: "1k", Options: []JobOption{{Value: "1k", Label: "1k（約 1MP）"}, {Value: "1.5k", Label: "1.5k（最長邊 1536px）"}}},
		// 空字串 option 讓作者能退回「不指定」；validateJobInput 會把空值視為未填。
		{Key: "mode", Label: "Tsubaki 模式", Kind: "select", Description: "只有 Tsubaki 系列模型接受，其他模型請留空", Options: []JobOption{{Value: "", Label: "不指定"}, {Value: "lite", Label: "Lite"}, {Value: "standard", Label: "Standard"}, {Value: "pro", Label: "Pro"}, {Value: "ultra", Label: "Ultra"}}},
		// PixAI batchSize 只接受 1 或 4，所以用 select 而不是 number。
		{Key: "candidate_count", Label: "候選張數", Kind: "select", Default: "1", Options: []JobOption{{Value: "1", Label: "1"}, {Value: "4", Label: "4"}}},
		{Key: "seed", Label: "Seed", Kind: "number", Description: "留空代表隨機", Min: number(0), Max: number(2147483647), Step: number(1)},
		{Key: "prompt_helper", Label: "PixAI Prompt 自動強化", Kind: "boolean", Default: true},
	}...)
}

type pixaiTask struct {
	ID               string `json:"id"`
	Status           string `json:"status"`
	MediaSafetyLevel string `json:"mediaSafetyLevel"`
	Outputs          struct {
		MediaIDs  []string `json:"mediaIds"`
		MediaURLs []string `json:"mediaUrls"`
	} `json:"outputs"`
}

// Generate 建立 PixAI task、輪詢到結束後立即下載；PixAI 產物不會永久保存，所以不能只留 URL。
func (a pixaiAdapter) Generate(ctx context.Context, settings, secrets map[string]string, inputs map[string]any, root string) (GenerateResult, error) {
	key := strings.TrimSpace(secrets["api_key"])
	if key == "" {
		return GenerateResult{}, errors.New("PixAI API Key 已不存在，請到設定頁重新填寫")
	}
	ctx, cancel := context.WithTimeout(ctx, pixaiMaxWait)
	defer cancel()
	request := map[string]any{"modelVersionId": inputs["model_version_id"], "prompt": inputs["prompt"]}
	for from, to := range map[string]string{"negative_prompt": "negativePrompt", "aspect_ratio": "aspectRatio", "size": "size", "mode": "mode"} {
		if value, ok := inputs[from].(string); ok && value != "" {
			request[to] = value
		}
	}
	batch, _ := strconv.Atoi(fmt.Sprint(inputs["candidate_count"]))
	request["batchSize"] = max(batch, 1)
	if seed, ok := inputs["seed"].(float64); ok {
		request["seed"] = int64(seed)
	}
	if helper, ok := inputs["prompt_helper"].(bool); ok && !helper {
		request["promptHelper"] = "disable"
	}
	if selected, ok := inputs["loras"].([]string); ok && len(selected) > 0 {
		weights := map[string]float64{}
		for _, item := range pixaiFavorites(settings, pixaiFavoriteLoRA) {
			weights[item.ID] = item.Weight
		}
		loras := make([]map[string]any, 0, len(selected))
		for _, id := range selected {
			loras = append(loras, map[string]any{"modelId": id, "weight": weights[id]})
		}
		request["loras"] = loras
	}
	task, err := a.task(ctx, http.MethodPost, "/v2/image/create", key, request, http.StatusCreated)
	if err != nil {
		return GenerateResult{}, err
	}
	// 作者中途停止或逾時時 PixAI 端仍會繼續跑（API 未提供取消），錯誤訊息要讓作者知道額度可能已扣。
	for task.Status == "waiting" || task.Status == "running" {
		select {
		case <-ctx.Done():
			return GenerateResult{}, fmt.Errorf("已停止等待 PixAI task %s（PixAI 端可能仍會完成並扣除額度）：%w", task.ID, ctx.Err())
		case <-time.After(a.pollInterval):
		}
		if task, err = a.task(ctx, http.MethodGet, "/v1/task/"+task.ID, key, nil, http.StatusOK); err != nil {
			return GenerateResult{}, err
		}
	}
	if task.Status != "completed" {
		return GenerateResult{}, fmt.Errorf("PixAI task %s 結束狀態為 %s", task.ID, task.Status)
	}
	if len(task.Outputs.MediaURLs) == 0 {
		return GenerateResult{}, fmt.Errorf("PixAI task %s 完成但沒有回傳圖片", task.ID)
	}
	model := fmt.Sprint(inputs["model_version_id"])
	result := GenerateResult{Root: root, Artifacts: make([]GeneratedArtifact, 0, len(task.Outputs.MediaURLs))}
	for index, mediaURL := range task.Outputs.MediaURLs {
		artifact, err := a.download(ctx, mediaURL, filepath.Join(root, fmt.Sprintf("pixai-%s-%d", task.ID, index+1)))
		if err != nil {
			return GenerateResult{}, fmt.Errorf("下載 PixAI 第 %d 張圖片失敗：%w", index+1, err)
		}
		parameters := cloneAnyMap(inputs)
		if task.MediaSafetyLevel != "" {
			parameters["media_safety_level"] = task.MediaSafetyLevel
		}
		artifact.ProviderJobID, artifact.Model, artifact.Parameters, artifact.CandidateGroup = task.ID, model, parameters, "pixai-"+task.ID
		result.Artifacts = append(result.Artifacts, artifact)
	}
	return result, nil
}

func (a pixaiAdapter) task(ctx context.Context, method, path, key string, payload any, want int) (pixaiTask, error) {
	status, body, err := a.call(ctx, method, path, key, payload)
	if err != nil {
		return pixaiTask{}, err
	}
	if status != want && status != http.StatusOK {
		return pixaiTask{}, pixaiError(status, body)
	}
	var task pixaiTask
	if err := json.Unmarshal(body, &task); err != nil || task.ID == "" {
		return pixaiTask{}, errors.New("PixAI 回傳無法解析的 task 資料")
	}
	return task, nil
}

// call 統一處理認證與錯誤 body 讀取；body 上限 1MB，task JSON 不會超過這個量級。
func (a pixaiAdapter) call(ctx context.Context, method, path, key string, payload any) (int, []byte, error) {
	var reader io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			return 0, nil, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, a.baseURL+path, reader)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := a.client.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("無法連線 PixAI：%w", err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	return response.StatusCode, body, err
}

// download 不帶 API key：mediaUrls 是 CDN 位址，避免把 token 送到第三方主機。
func (a pixaiAdapter) download(ctx context.Context, mediaURL, pathWithoutExt string) (GeneratedArtifact, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return GeneratedArtifact{}, err
	}
	response, err := a.client.Do(req)
	if err != nil {
		return GeneratedArtifact{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return GeneratedArtifact{}, fmt.Errorf("HTTP %d", response.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, pixaiMaxDownload+1))
	if err != nil {
		return GeneratedArtifact{}, err
	}
	if len(raw) > pixaiMaxDownload {
		return GeneratedArtifact{}, errors.New("圖片超過 30MB")
	}
	// 以內容判斷格式，不信任 CDN 的 Content-Type。
	mimeType := http.DetectContentType(raw)
	extension, ok := pixaiImageTypes[mimeType]
	if !ok {
		return GeneratedArtifact{}, fmt.Errorf("不支援的圖片格式 %s", mimeType)
	}
	path := pathWithoutExt + extension
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return GeneratedArtifact{}, err
	}
	// WebP 沒有註冊 decoder，尺寸留 0 不影響上傳。
	config, _, _ := image.DecodeConfig(bytes.NewReader(raw))
	return GeneratedArtifact{LocalPath: path, FileName: filepath.Base(path), MIMEType: mimeType, Width: config.Width, Height: config.Height}, nil
}

// pixaiError 只取 PixAI 的 message 欄位（格式 {"message","code"}），避免把整段 body 塞進對話紀錄。
func pixaiError(status int, body []byte) error {
	var payload struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Message != "" {
		return fmt.Errorf("PixAI 回傳 HTTP %d：%s", status, payload.Message)
	}
	return fmt.Errorf("PixAI 回傳 HTTP %d", status)
}

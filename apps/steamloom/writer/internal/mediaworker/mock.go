package mediaworker

import (
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
)

type mockAdapter struct{}

// NewMockAdapter 提供不依賴外部服務的完整 Registry／儲存／連線測試驗證入口。
func NewMockAdapter() Adapter { return mockAdapter{} }

func (mockAdapter) Descriptor() AdapterDescriptor {
	return AdapterDescriptor{
		ID: "mock-image", Name: "Mock Image Worker", Description: "驗證 Writer 的 Worker 連線與 capability summary，不會產生或上傳檔案", MediaTypes: []string{"image"},
		Fields: []SettingField{{Key: "scenario", Label: "測試情境", Kind: "text", Required: true, Default: "success", Placeholder: "success 或 error"}},
	}
}

func (mockAdapter) Discover(_ context.Context, settings, _ map[string]string) (Discovery, error) {
	if settings["scenario"] == "error" {
		return Discovery{}, errors.New("Mock Worker 模擬連線失敗")
	}
	if settings["scenario"] != "success" {
		return Discovery{}, errors.New("測試情境只接受 success 或 error")
	}
	return Discovery{
		Capabilities: []string{"text_to_image", "image_to_image", "reference_image", "batch_candidates"},
		Message:      "Mock Worker 連線測試成功；不會送出任何外部請求",
	}, nil
}

func (mockAdapter) JobFields(map[string]string) []JobField {
	return []JobField{
		{Key: "prompt", Label: "Prompt", Kind: "textarea", Required: true},
		{Key: "negative_prompt", Label: "Negative prompt", Kind: "textarea"},
		{Key: "style", Label: "Style", Kind: "select", Default: "illustration", Options: []JobOption{{Value: "illustration", Label: "Illustration"}, {Value: "concept", Label: "Concept art"}, {Value: "manga", Label: "Manga"}}},
		{Key: "width", Label: "Width", Kind: "number", Default: 768, Min: number(256), Max: number(1024), Step: number(64)},
		{Key: "height", Label: "Height", Kind: "number", Default: 768, Min: number(256), Max: number(1024), Step: number(64)},
		{Key: "candidate_count", Label: "Candidates", Kind: "number", Default: 2, Min: number(1), Max: number(4), Step: number(1)},
		{Key: "seed", Label: "Seed", Kind: "number", Default: 42, Min: number(0), Max: number(999999), Step: number(1)},
	}
}

// Generate 產出可預覽的 deterministic PNG，只用來驗證 lifecycle，不模擬 AI 品質。
func (mockAdapter) Generate(ctx context.Context, _, _ map[string]string, inputs map[string]any, root string) (GenerateResult, error) {
	if err := ctx.Err(); err != nil {
		return GenerateResult{}, err
	}
	width, height := int(inputs["width"].(float64)), int(inputs["height"].(float64))
	count, seed := int(inputs["candidate_count"].(float64)), int(inputs["seed"].(float64))
	result := GenerateResult{Root: root, Artifacts: make([]GeneratedArtifact, 0, count)}
	for index := range count {
		if err := ctx.Err(); err != nil {
			return GenerateResult{}, err
		}
		name := fmt.Sprintf("mock-candidate-%d.png", index+1)
		path := filepath.Join(root, name)
		if err := writeMockPNG(path, width, height, seed+index); err != nil {
			return GenerateResult{}, err
		}
		result.Artifacts = append(result.Artifacts, GeneratedArtifact{
			LocalPath: path, FileName: name, MIMEType: "image/png", Model: "mock-image-v1", Parameters: cloneAnyMap(inputs),
			ProviderJobID: fmt.Sprintf("mock-%d-%d", seed, index+1), CandidateGroup: "mock-candidates", Width: width, Height: height,
		})
	}
	return result, nil
}

func writeMockPNG(path string, width, height, seed int) error {
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	base := uint8(seed % 180)
	for y := range height {
		for x := range width {
			band := uint8((x/32+y/32)%2) * 28
			canvas.SetRGBA(x, y, color.RGBA{R: 45 + base/3 + band, G: 70 + base/4, B: 120 + base/2 - band/2, A: 255})
		}
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return png.Encode(file, canvas)
}

func number(value float64) *float64 { return &value }

func cloneAnyMap(input map[string]any) map[string]any {
	result := make(map[string]any, len(input))
	for key, value := range input {
		result[key] = value
	}
	return result
}

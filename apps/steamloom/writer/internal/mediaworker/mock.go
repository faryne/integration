package mediaworker

import (
	"context"
	"errors"
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

package mediaworker

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

type memoryVault struct{ values map[string]map[string]string }

func (v *memoryVault) load(id string) (map[string]string, error) { return cloneMap(v.values[id]), nil }
func (v *memoryVault) save(id string, values map[string]string) error {
	v.values[id] = cloneMap(values)
	return nil
}

func TestWorkerJobSpecValidationAndExecution(t *testing.T) {
	registry, err := NewRegistry(fakeAdapter{})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), &memoryVault{values: map[string]map[string]string{}})
	worker, err := service.Save(SaveInput{AdapterID: "fake", Name: "Fake", Enabled: true, Settings: map[string]string{"endpoint": "https://example.com"}, Secrets: map[string]string{"token": "secret"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Test(context.Background(), worker.ID); err != nil {
		t.Fatal(err)
	}
	spec, err := service.JobSpec(worker.ID)
	if err != nil || len(spec.Fields) == 0 {
		t.Fatalf("job spec = %#v, err = %v", spec, err)
	}
	input, err := service.ValidateJob(worker.ID, map[string]any{"prompt": "藍髮少女", "candidate_count": 1})
	if err != nil || input["width"] != float64(768) {
		t.Fatalf("validated input = %#v, err = %v", input, err)
	}
	result, err := service.Execute(context.Background(), worker.ID, input)
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(result.Root)
	if len(result.Artifacts) != 1 {
		t.Fatalf("artifacts = %#v", result.Artifacts)
	}
	if _, err := os.Stat(result.Artifacts[0].LocalPath); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ValidateJob(worker.ID, map[string]any{"prompt": "test", "unknown": true}); err == nil {
		t.Fatal("unknown job field should fail")
	}
}
func (v *memoryVault) delete(id string) error { delete(v.values, id); return nil }

type fakeAdapter struct{}

func (fakeAdapter) Descriptor() AdapterDescriptor {
	return AdapterDescriptor{ID: "fake", Name: "Fake", MediaTypes: []string{"image"}, Fields: []SettingField{
		{Key: "endpoint", Label: "服務位址", Required: true},
		{Key: "token", Label: "Token", Secret: true},
	}}
}
func (fakeAdapter) Discover(context.Context, map[string]string, map[string]string) (Discovery, error) {
	return Discovery{Capabilities: []string{"text_to_image"}, Message: "ok"}, nil
}
func (fakeAdapter) JobFields(map[string]string) []JobField {
	return []JobField{
		{Key: "prompt", Label: "Prompt", Kind: "textarea", Required: true},
		{Key: "width", Label: "Width", Kind: "number", Default: 768, Min: number(256), Max: number(1024)},
		{Key: "candidate_count", Label: "Candidates", Kind: "number", Default: 1, Min: number(1), Max: number(4)},
	}
}
func (fakeAdapter) Generate(_ context.Context, _, _ map[string]string, _ map[string]any, root string) (GenerateResult, error) {
	path := filepath.Join(root, "candidate.png")
	if err := os.WriteFile(path, []byte("fake image"), 0o600); err != nil {
		return GenerateResult{}, err
	}
	return GenerateResult{Root: root, Artifacts: []GeneratedArtifact{{LocalPath: path, FileName: "candidate.png", MIMEType: "image/png"}}}, nil
}

func TestServiceKeepsSecretsOutOfFileAndTestsWorker(t *testing.T) {
	registry, err := NewRegistry(fakeAdapter{})
	if err != nil {
		t.Fatal(err)
	}
	vault := &memoryVault{values: map[string]map[string]string{}}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), vault)
	worker, err := service.Save(SaveInput{AdapterID: "fake", Name: "Studio", Enabled: true, Settings: map[string]string{"endpoint": "https://example.com", "token": "must-not-persist"}, Secrets: map[string]string{"token": "secret"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, exists := worker.Settings["token"]; exists || !worker.HasSecrets["token"] {
		t.Fatalf("secret leaked or missing marker: %#v", worker)
	}
	tested, err := service.Test(context.Background(), worker.ID)
	if err != nil {
		t.Fatal(err)
	}
	if tested.Status != StatusOnline || len(tested.Capabilities) != 1 {
		t.Fatalf("tested worker = %#v", tested)
	}
	if err := service.Delete(worker.ID); err != nil {
		t.Fatal(err)
	}
	if len(vault.values) != 0 {
		t.Fatalf("secret remains after delete: %#v", vault.values)
	}
}

func TestWorkersHideRemovedAdapters(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workers.json")
	store := fileStore{path: path}
	if err := store.save([]storedWorker{{ID: "legacy", AdapterID: "mock-image", Name: "Legacy Mock", Enabled: true}}); err != nil {
		t.Fatal(err)
	}
	registry, err := NewRegistry(fakeAdapter{})
	if err != nil {
		t.Fatal(err)
	}
	workers, err := NewService(registry, path, &memoryVault{values: map[string]map[string]string{}}).Workers()
	if err != nil || len(workers) != 0 {
		t.Fatalf("workers = %#v, err = %v", workers, err)
	}
}

func TestAgentCapabilitiesOnlyIncludeEnabledOnlineWorkers(t *testing.T) {
	registry, err := NewRegistry(fakeAdapter{})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), &memoryVault{values: map[string]map[string]string{}})
	online, err := service.Save(SaveInput{AdapterID: "fake", Name: "可用 Worker", Enabled: true, Settings: map[string]string{"endpoint": "https://online.example.com"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Test(context.Background(), online.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Save(SaveInput{AdapterID: "fake", Name: "未測試 Worker", Enabled: true, Settings: map[string]string{"endpoint": "https://untested.example.com"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Save(SaveInput{AdapterID: "fake", Name: "停用 Worker", Enabled: false, Settings: map[string]string{"endpoint": "https://disabled.example.com"}}); err != nil {
		t.Fatal(err)
	}

	capabilities, err := service.AgentCapabilities()
	if err != nil {
		t.Fatal(err)
	}
	if len(capabilities) != 1 || capabilities[0].WorkerID != online.ID || capabilities[0].Name != "可用 Worker" {
		t.Fatalf("agent capabilities = %#v", capabilities)
	}
}

func TestCompatibleWorkersKeepsRecommendationAndMatchingCapabilities(t *testing.T) {
	registry, err := NewRegistry(fakeAdapter{})
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), &memoryVault{values: map[string]map[string]string{}})
	first, err := service.Save(SaveInput{AdapterID: "fake", Name: "PixAI", Enabled: true, Settings: map[string]string{"endpoint": "https://pixai.example.com"}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.Save(SaveInput{AdapterID: "fake", Name: "ComfyUI", Enabled: true, Settings: map[string]string{"endpoint": "https://comfy.example.com"}})
	if err != nil {
		t.Fatal(err)
	}
	for _, worker := range []Worker{*first, *second} {
		if _, err := service.Test(context.Background(), worker.ID); err != nil {
			t.Fatal(err)
		}
	}
	options, err := service.CompatibleWorkers(first.ID)
	if err != nil || len(options) != 2 {
		t.Fatalf("options = %#v, err = %v", options, err)
	}
	recommended := 0
	for _, option := range options {
		if option.Recommended {
			recommended++
			if option.WorkerID != first.ID {
				t.Fatalf("wrong recommendation: %#v", option)
			}
		}
	}
	if recommended != 1 {
		t.Fatalf("recommended options = %d: %#v", recommended, options)
	}
}

// 必填 secret：第一次存要有值；之後留白代表沿用；勾選清除又沒填新值就擋下。
func TestSaveRequiresSecretAndValidURL(t *testing.T) {
	registry, err := NewRegistry(NewPixAIAdapter(nil), NewComfyUIAdapter(nil))
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), &memoryVault{values: map[string]map[string]string{}})
	if _, err := service.Save(SaveInput{AdapterID: "pixai", Name: "PixAI"}); err == nil {
		t.Fatal("missing API key should fail")
	}
	worker, err := service.Save(SaveInput{AdapterID: "pixai", Name: "PixAI", Secrets: map[string]string{"api_key": "k"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Save(SaveInput{ID: worker.ID, AdapterID: "pixai", Name: "PixAI 2"}); err != nil {
		t.Fatalf("blank secret should keep the stored key: %v", err)
	}
	if _, err := service.Save(SaveInput{ID: worker.ID, AdapterID: "pixai", Name: "PixAI", ClearSecrets: []string{"api_key"}}); err == nil {
		t.Fatal("clearing a required secret should fail")
	}
	if _, err := service.Save(SaveInput{AdapterID: "comfyui", Name: "Comfy", Settings: map[string]string{"endpoint": "localhost:8188"}}); err == nil {
		t.Fatal("invalid endpoint should fail")
	}
}

// 常用清單 Save 驗證：名稱必填、ID 不可重複、權重 0～1。
func TestSaveValidatesCatalogSettings(t *testing.T) {
	registry, err := NewRegistry(NewPixAIAdapter(nil))
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), &memoryVault{values: map[string]map[string]string{}})
	save := func(loras string) error {
		_, err := service.Save(SaveInput{AdapterID: "pixai", Name: "PixAI", Secrets: map[string]string{"api_key": "k"}, Settings: map[string]string{pixaiFavoriteLoRA: loras}})
		return err
	}
	if err := save(`[{"id":"1","name":"A","weight":0.5}]`); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{`[{"id":"1","name":"","weight":1}]`, `[{"id":"1","name":"A","weight":1},{"id":"1","name":"B","weight":1}]`, `[{"id":"1","name":"A","weight":1.5}]`, `not json`} {
		if err := save(bad); err == nil {
			t.Fatalf("catalog %s should fail", bad)
		}
	}
}

// 多選欄位：只接受選項、不可重複、不超過 Max。
func TestMultiselectJobField(t *testing.T) {
	fields := []JobField{{Key: "loras", Label: "LoRA", Kind: "multiselect", Max: number(2), Options: []JobOption{{Value: "a", Label: "A"}, {Value: "b", Label: "B"}, {Value: "c", Label: "C"}}}}
	if got, err := validateJobInput(fields, map[string]any{"loras": []any{"a", "b"}}); err != nil || len(got["loras"].([]string)) != 2 {
		t.Fatalf("valid selection = %#v, %v", got, err)
	}
	if got, err := validateJobInput(fields, map[string]any{"loras": []any{}}); err != nil || got["loras"] != nil {
		t.Fatalf("empty selection should be omitted: %#v, %v", got, err)
	}
	for _, bad := range [][]any{{"a", "b", "c"}, {"a", "a"}, {"z"}} {
		if _, err := validateJobInput(fields, map[string]any{"loras": bad}); err == nil {
			t.Fatalf("selection %v should fail", bad)
		}
	}
}

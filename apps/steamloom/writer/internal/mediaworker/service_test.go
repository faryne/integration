package mediaworker

import (
	"context"
	"errors"
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
	spec, err := service.JobSpec(worker.ID)
	if err != nil || len(spec.Fields) == 0 {
		t.Fatalf("job spec = %#v, err = %v", spec, err)
	}
	policy, err := service.ExecutionPolicy(worker.ID)
	if err != nil || policy != DefaultExecutionPolicy {
		t.Fatalf("execution policy = %#v, err = %v", policy, err)
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
func (fakeAdapter) Discover(_ context.Context, settings map[string]string, _ map[string]string) (Discovery, error) {
	if settings["endpoint"] == "https://offline.example.com" {
		return Discovery{}, errors.New("offline")
	}
	return Discovery{Capabilities: []string{"text_to_image"}, Message: "ok"}, nil
}
func (fakeAdapter) Capabilities(map[string]string) []string { return []string{"text_to_image"} }
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

func TestDefaultAdaptersHideUnverifiedWorkersOutsideDev(t *testing.T) {
	release, err := NewRegistry(defaultAdapters(false)...)
	if err != nil {
		t.Fatal(err)
	}
	if adapters := release.List(); len(adapters) != 1 || adapters[0].ID != "pixai" {
		t.Fatalf("release adapters = %#v", adapters)
	}
	dev, err := NewRegistry(defaultAdapters(true)...)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := dev.Get("comfyui"); !ok {
		t.Fatal("dev registry should contain ComfyUI")
	}
	if adapter, ok := dev.Get("fal"); !ok {
		t.Fatal("dev registry should contain fal")
	} else if _, ok := adapter.(Generator); !ok {
		t.Fatal("fal should execute media jobs")
	}
	if adapter, ok := dev.Get("stable-diffusion-webui"); !ok {
		t.Fatal("dev registry should contain Stable Diffusion WebUI")
	} else if _, ok := adapter.(Generator); !ok {
		t.Fatal("Stable Diffusion WebUI should execute media jobs")
	}
}

func TestAgentCapabilitiesIncludeEnabledWorkersWithoutConnectionTest(t *testing.T) {
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
	offline, err := service.Save(SaveInput{AdapterID: "fake", Name: "連線異常 Worker", Enabled: true, Settings: map[string]string{"endpoint": "https://offline.example.com"}})
	if err != nil {
		t.Fatal(err)
	}
	if tested, err := service.Test(context.Background(), offline.ID); err != nil || tested.Status != StatusError {
		t.Fatalf("failed diagnostic = %#v, err = %v", tested, err)
	}
	if _, err := service.Save(SaveInput{AdapterID: "fake", Name: "停用 Worker", Enabled: false, Settings: map[string]string{"endpoint": "https://disabled.example.com"}}); err != nil {
		t.Fatal(err)
	}

	capabilities, err := service.AgentCapabilities()
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, capability := range capabilities {
		names[capability.Name] = true
	}
	if len(capabilities) != 3 || !names["可用 Worker"] || !names["未測試 Worker"] || !names["連線異常 Worker"] {
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
	for _, bad := range []string{`[{"id":"1","name":"","weight":1}]`, `[{"id":"1","name":"A","weight":1},{"id":"1","name":"B","weight":1}]`, `not json`} {
		if err := save(bad); err == nil {
			t.Fatalf("catalog %s should fail", bad)
		}
	}
}

func TestWeightedSelectJobField(t *testing.T) {
	fields := []JobField{{Key: "loras", Label: "LoRA", Kind: "weighted_select", Max: number(2), Options: []JobOption{{Value: "a", Label: "A"}, {Value: "b", Label: "B"}}, ItemNumber: &JobItemNumber{Label: "權重", Default: 0.7, Min: 0, Max: 1, Step: 0.05}}}
	got, err := validateJobInput(fields, map[string]any{"loras": []any{map[string]any{"value": "a", "weight": 0.7}}})
	if err != nil || len(got["loras"].([]JobWeightedSelection)) != 1 || got["loras"].([]JobWeightedSelection)[0].Weight != 0.7 {
		t.Fatalf("weighted selection = %#v, %v", got, err)
	}
	for _, bad := range []any{
		[]any{map[string]any{"value": "a", "weight": 1.1}},
		[]any{map[string]any{"value": "a", "weight": 0.7}, map[string]any{"value": "a", "weight": 0.5}},
		[]any{map[string]any{"value": "unknown", "weight": 0.7}},
	} {
		if _, err := validateJobInput(fields, map[string]any{"loras": bad}); err == nil {
			t.Fatalf("selection %#v should fail", bad)
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

func TestConditionalJobField(t *testing.T) {
	fields := []JobField{
		{Key: "model", Label: "Model", Kind: "select", Required: true, Default: "other", Options: []JobOption{{Value: "other", Label: "Other"}, {Value: "tsubaki", Label: "Tsubaki"}}},
		{Key: "mode", Label: "Mode", Kind: "select", Required: true, VisibleWhen: &JobFieldCondition{Key: "model", Values: []string{"tsubaki"}}, Options: []JobOption{{Value: "pro", Label: "Pro"}}},
	}
	hidden, err := validateJobInput(fields, map[string]any{"mode": "pro"})
	if err != nil {
		t.Fatal(err)
	}
	if _, exists := hidden["mode"]; exists {
		t.Fatalf("hidden field should be omitted: %#v", hidden)
	}
	visible, err := validateJobInput(fields, map[string]any{"model": "tsubaki", "mode": "pro"})
	if err != nil || visible["mode"] != "pro" {
		t.Fatalf("visible field = %#v, err = %v", visible, err)
	}
	if _, err := validateJobInput(fields, map[string]any{"model": "tsubaki"}); err == nil {
		t.Fatal("visible required field should fail validation")
	}
}

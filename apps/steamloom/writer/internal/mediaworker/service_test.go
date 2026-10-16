package mediaworker

import (
	"context"
	"path/filepath"
	"testing"
)

type memoryVault struct{ values map[string]map[string]string }

func (v *memoryVault) load(id string) (map[string]string, error) { return cloneMap(v.values[id]), nil }
func (v *memoryVault) save(id string, values map[string]string) error {
	v.values[id] = cloneMap(values)
	return nil
}
func (v *memoryVault) delete(id string) error { delete(v.values, id); return nil }

type fakeAdapter struct{}

func (fakeAdapter) Descriptor() AdapterDescriptor {
	return AdapterDescriptor{ID: "fake", Name: "Fake", Fields: []SettingField{
		{Key: "endpoint", Label: "服務位址", Required: true},
		{Key: "token", Label: "Token", Secret: true},
	}}
}
func (fakeAdapter) Discover(context.Context, map[string]string, map[string]string) (Discovery, error) {
	return Discovery{Capabilities: []string{"text_to_image"}, Message: "ok"}, nil
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

func TestAgentCapabilitiesOnlyIncludeEnabledOnlineWorkers(t *testing.T) {
	registry, err := NewRegistry(NewMockAdapter())
	if err != nil {
		t.Fatal(err)
	}
	service := NewService(registry, filepath.Join(t.TempDir(), "workers.json"), &memoryVault{values: map[string]map[string]string{}})
	online, err := service.Save(SaveInput{AdapterID: "mock-image", Name: "可用 Mock", Enabled: true, Settings: map[string]string{"scenario": "success"}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Test(context.Background(), online.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Save(SaveInput{AdapterID: "mock-image", Name: "未測試 Mock", Enabled: true, Settings: map[string]string{"scenario": "success"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Save(SaveInput{AdapterID: "mock-image", Name: "停用 Mock", Enabled: false, Settings: map[string]string{"scenario": "success"}}); err != nil {
		t.Fatal(err)
	}

	capabilities, err := service.AgentCapabilities()
	if err != nil {
		t.Fatal(err)
	}
	if len(capabilities) != 1 || capabilities[0].WorkerID != online.ID || capabilities[0].Name != "可用 Mock" {
		t.Fatalf("agent capabilities = %#v", capabilities)
	}
}

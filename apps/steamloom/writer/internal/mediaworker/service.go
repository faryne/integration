package mediaworker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// Service 負責 instance 設定、健康狀態與密鑰生命週期；不負責 Media Job 排程。
type Service struct {
	mu       sync.Mutex
	registry *Registry
	store    fileStore
	vault    secretVault
}

// NewDefault 建立桌面應用程式用的預設 Registry 與全域設定儲存位置。
func NewDefault() *Service {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	client := &http.Client{Timeout: 10 * time.Second}
	registry, err := NewRegistry(NewComfyUIAdapter(client), NewCompatibleAdapter(client), NewMockAdapter())
	if err != nil {
		panic(err)
	}
	return NewService(registry, filepath.Join(dir, "SteamLoom Writer", "workers.json"), keyringVault{})
}

// NewService 可注入 store 與 vault，讓 adapter 與持久化行為可以獨立測試。
func NewService(registry *Registry, path string, vault secretVault) *Service {
	return &Service{registry: registry, store: fileStore{path: path}, vault: vault}
}

// Adapters 回傳正式註冊清單，前端不另外維護 provider 名單。
func (s *Service) Adapters() []AdapterDescriptor { return s.registry.List() }

// AgentCapabilities 只暴露已啟用且連線正常的安全摘要；設定與密鑰不會離開 Service。
func (s *Service) AgentCapabilities() ([]AgentCapability, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	workers, err := s.store.load()
	if err != nil {
		return nil, err
	}
	result := []AgentCapability{}
	for _, worker := range workers {
		adapter, exists := s.registry.Get(worker.AdapterID)
		if !exists || !worker.Enabled || worker.Status != StatusOnline || len(worker.Capabilities) == 0 {
			continue
		}
		result = append(result, AgentCapability{
			WorkerID: worker.ID, Name: worker.Name,
			MediaTypes: append([]string{}, adapter.Descriptor().MediaTypes...), Capabilities: append([]string{}, worker.Capabilities...),
		})
	}
	sort.SliceStable(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result, nil
}

// Workers 列出裝置上的全域設定，密鑰只回傳是否存在。
func (s *Service) Workers() ([]Worker, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	stored, err := s.store.load()
	if err != nil {
		return nil, err
	}
	workers := make([]Worker, 0, len(stored))
	for _, item := range stored {
		worker, err := s.public(item)
		if err != nil {
			return nil, err
		}
		workers = append(workers, worker)
	}
	sort.SliceStable(workers, func(i, j int) bool { return workers[i].Name < workers[j].Name })
	return workers, nil
}

// Save 建立或更新 Worker；空白 secret 代表保留，只有 ClearSecrets 會刪除密鑰。
func (s *Service) Save(input SaveInput) (*Worker, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	adapter, ok := s.registry.Get(input.AdapterID)
	if !ok {
		return nil, errors.New("找不到指定的 Worker adapter")
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, errors.New("Worker 名稱不能留白")
	}
	if input.Settings == nil {
		input.Settings = map[string]string{}
	}
	for _, field := range adapter.Descriptor().Fields {
		if field.Required && !field.Secret && strings.TrimSpace(input.Settings[field.Key]) == "" {
			return nil, errors.New(field.Label + "不能留白")
		}
	}
	workers, err := s.store.load()
	if err != nil {
		return nil, err
	}
	index := workerIndex(workers, input.ID)
	if input.ID == "" {
		input.ID, err = newID()
		if err != nil {
			return nil, err
		}
	} else if index < 0 {
		return nil, errors.New("找不到指定的 Worker")
	}
	secrets, err := s.vault.load(input.ID)
	if err != nil {
		return nil, err
	}
	for key, value := range input.Secrets {
		if value = strings.TrimSpace(value); value != "" {
			secrets[key] = value
		}
	}
	for _, key := range input.ClearSecrets {
		delete(secrets, key)
	}
	if err := s.vault.save(input.ID, secrets); err != nil {
		return nil, err
	}
	item := storedWorker{ID: input.ID, AdapterID: input.AdapterID, Name: input.Name, Enabled: input.Enabled, Settings: cleanSettings(adapter.Descriptor(), input.Settings), Status: StatusUnconfigured}
	if index >= 0 {
		previous := workers[index]
		if previous.AdapterID == item.AdapterID && mapsEqual(previous.Settings, item.Settings) && len(input.Secrets) == 0 && len(input.ClearSecrets) == 0 {
			item.Status, item.StatusMessage, item.Capabilities, item.LastCheckedAt = previous.Status, previous.StatusMessage, previous.Capabilities, previous.LastCheckedAt
		}
		workers[index] = item
	} else {
		workers = append(workers, item)
	}
	if err := s.store.save(workers); err != nil {
		return nil, err
	}
	result, err := s.public(item)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// Test 執行 adapter discovery 並保存健康狀態；失敗是可呈現狀態，不會自動停用 Worker。
func (s *Service) Test(ctx context.Context, id string) (*Worker, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	workers, err := s.store.load()
	if err != nil {
		return nil, err
	}
	index := workerIndex(workers, id)
	if index < 0 {
		return nil, errors.New("找不到指定的 Worker")
	}
	item := workers[index]
	adapter, ok := s.registry.Get(item.AdapterID)
	if !ok {
		return nil, errors.New("這個 Worker 的 adapter 已不存在")
	}
	secrets, err := s.vault.load(id)
	if err != nil {
		return nil, err
	}
	discovery, discoverErr := adapter.Discover(ctx, item.Settings, secrets)
	item.LastCheckedAt = time.Now().UTC()
	if discoverErr != nil {
		item.Status, item.StatusMessage, item.Capabilities = StatusError, discoverErr.Error(), []string{}
	} else {
		item.Status, item.StatusMessage, item.Capabilities = StatusOnline, discovery.Message, discovery.Capabilities
	}
	workers[index] = item
	if err := s.store.save(workers); err != nil {
		return nil, err
	}
	result, err := s.public(item)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete 同時移除非敏感設定與 OS Keychain 中的密鑰。
func (s *Service) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	workers, err := s.store.load()
	if err != nil {
		return err
	}
	index := workerIndex(workers, id)
	if index < 0 {
		return errors.New("找不到指定的 Worker")
	}
	if err := s.vault.delete(id); err != nil {
		return err
	}
	return s.store.save(append(workers[:index], workers[index+1:]...))
}

func (s *Service) public(item storedWorker) (Worker, error) {
	hasSecrets := map[string]bool{}
	secrets, err := s.vault.load(item.ID)
	if err != nil {
		return Worker{}, err
	}
	for key, value := range secrets {
		hasSecrets[key] = value != ""
	}
	checked := ""
	if !item.LastCheckedAt.IsZero() {
		checked = item.LastCheckedAt.Format(time.RFC3339)
	}
	return Worker{ID: item.ID, AdapterID: item.AdapterID, Name: item.Name, Enabled: item.Enabled, Settings: cloneMap(item.Settings), HasSecrets: hasSecrets, Status: item.Status, StatusMessage: item.StatusMessage, Capabilities: append([]string{}, item.Capabilities...), LastCheckedAt: checked}, nil
}

func cleanSettings(descriptor AdapterDescriptor, input map[string]string) map[string]string {
	result := map[string]string{}
	for _, field := range descriptor.Fields {
		if !field.Secret {
			result[field.Key] = strings.TrimSpace(input[field.Key])
		}
	}
	return result
}

func workerIndex(workers []storedWorker, id string) int {
	for i := range workers {
		if workers[i].ID == id {
			return i
		}
	}
	return -1
}

func newID() (string, error) {
	raw := make([]byte, 12)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func cloneMap(input map[string]string) map[string]string {
	result := make(map[string]string, len(input))
	for key, value := range input {
		result[key] = value
	}
	return result
}

func mapsEqual(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for key, value := range a {
		if b[key] != value {
			return false
		}
	}
	return true
}

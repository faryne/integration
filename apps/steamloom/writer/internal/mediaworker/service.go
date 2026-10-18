package mediaworker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
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

// NewDefault 建立桌面應用程式用的預設 Registry 與全域設定儲存位置；未完成實機驗證的 adapter 只在 dev 版註冊。
func NewDefault(dev bool) *Service {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	registry, err := NewRegistry(defaultAdapters(dev)...)
	if err != nil {
		panic(err)
	}
	return NewService(registry, filepath.Join(dir, "SteamLoom Writer", "workers.json"), keyringVault{})
}

func defaultAdapters(dev bool) []Adapter {
	// PixAI 需要下載整張成圖，10 秒上限對 1.5k PNG 太緊，另用較寬的 client。
	adapters := []Adapter{NewPixAIAdapter(&http.Client{Timeout: time.Minute})}
	if dev {
		adapters = append(adapters,
			NewComfyUIAdapter(&http.Client{Timeout: 10 * time.Second}),
			NewStableDiffusionWebUIAdapter(&http.Client{Timeout: 10 * time.Minute}),
		)
	}
	return adapters
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
		_, executable := adapter.(Generator)
		if !exists || !executable || !worker.Enabled || worker.Status != StatusOnline || len(worker.Capabilities) == 0 {
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

// CompatibleWorkers 以 Agent 推薦項目的媒體類型與能力取交集，讓作者選擇真正執行者。
func (s *Service) CompatibleWorkers(recommendedID string) ([]WorkerOption, error) {
	capabilities, err := s.AgentCapabilities()
	if err != nil {
		return nil, err
	}
	var recommended *AgentCapability
	for index := range capabilities {
		if capabilities[index].WorkerID == recommendedID {
			recommended = &capabilities[index]
			break
		}
	}
	if recommended == nil {
		return nil, errors.New("Agent 推薦的 Worker 目前無法使用")
	}
	requiredCapability := textGenerationCapability(recommended.Capabilities)
	if requiredCapability == "" {
		return nil, errors.New("Agent 推薦的 Worker 不支援文字生成媒體")
	}
	result := make([]WorkerOption, 0, len(capabilities))
	for _, candidate := range capabilities {
		if stringSetsOverlap(recommended.MediaTypes, candidate.MediaTypes) && containsString(candidate.Capabilities, requiredCapability) {
			result = append(result, WorkerOption{WorkerID: candidate.WorkerID, Name: candidate.Name, Recommended: candidate.WorkerID == recommendedID})
		}
	}
	return result, nil
}

func textGenerationCapability(values []string) string {
	for _, value := range values {
		if strings.HasPrefix(value, "text_to_") {
			return value
		}
	}
	return ""
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func stringSetsOverlap(left, right []string) bool {
	values := make(map[string]bool, len(left))
	for _, value := range left {
		values[value] = true
	}
	for _, value := range right {
		if values[value] {
			return true
		}
	}
	return false
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
		// adapter 下架後不再把殘留設定顯示成無法操作的 Worker；原始設定檔仍保留，避免升級時破壞使用者資料。
		if _, exists := s.registry.Get(item.AdapterID); !exists {
			continue
		}
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
		if value := strings.TrimSpace(input.Settings[field.Key]); field.Kind == "url" && value != "" {
			if _, err := endpoint(value); err != nil {
				return nil, fmt.Errorf("%s：%w", field.Label, err)
			}
		}
		if field.Kind == "catalog" {
			if err := validateCatalog(field, input.Settings[field.Key]); err != nil {
				return nil, err
			}
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
	// 必填 secret 要看合併後結果：留白代表沿用已存值，只有勾選清除且沒填新值才算缺。
	for _, field := range adapter.Descriptor().Fields {
		if field.Required && field.Secret && secrets[field.Key] == "" {
			return nil, errors.New(field.Label + "不能留白")
		}
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
	if discoverErr == nil {
		// 連線測試時順便驗證 adapter 自帶的 schema，避免壞 schema 讓 Agent 看得到卻跑不動。
		if generator, executable := adapter.(Generator); executable {
			if fields := generator.JobFields(item.Settings); len(fields) == 0 {
				discoverErr = errors.New("Worker 沒有提供可執行的 Job schema")
			} else {
				discoverErr = validateJobSchema(fields)
			}
		}
	}
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

// JobSpec 只回傳表單 schema，不暴露 Worker endpoint、設定或密鑰。
func (s *Service) JobSpec(id string) (*JobSpec, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	worker, generator, err := s.executableWorker(id)
	if err != nil {
		return nil, err
	}
	return &JobSpec{WorkerID: worker.ID, WorkerName: worker.Name, Fields: generator.JobFields(worker.Settings)}, nil
}

// ValidateJob 套用 Worker schema 的預設值並拒絕未知或不合法欄位。
func (s *Service) ValidateJob(id string, input map[string]any) (map[string]any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	worker, generator, err := s.executableWorker(id)
	if err != nil {
		return nil, err
	}
	return validateJobInput(generator.JobFields(worker.Settings), input)
}

// Execute 驗證 job 後才把設定、密鑰與輸入交給 adapter；Agent 不會進入這條路徑。
func (s *Service) Execute(ctx context.Context, id string, input map[string]any) (GenerateResult, error) {
	s.mu.Lock()
	worker, generator, err := s.executableWorker(id)
	if err != nil {
		s.mu.Unlock()
		return GenerateResult{}, err
	}
	validated, err := validateJobInput(generator.JobFields(worker.Settings), input)
	if err != nil {
		s.mu.Unlock()
		return GenerateResult{}, err
	}
	secrets, err := s.vault.load(id)
	s.mu.Unlock()
	if err != nil {
		return GenerateResult{}, err
	}
	root, err := os.MkdirTemp("", "steamloom-worker-job-*")
	if err != nil {
		return GenerateResult{}, err
	}
	result, err := generator.Generate(ctx, cloneMap(worker.Settings), secrets, validated, root)
	if err != nil {
		_ = os.RemoveAll(root)
		return GenerateResult{}, err
	}
	// 輸出目錄由 Writer 建立與回收，不信任 adapter 自行指定可遞迴刪除的路徑。
	result.Root = root
	return result, nil
}

func (s *Service) executableWorker(id string) (storedWorker, Generator, error) {
	workers, err := s.store.load()
	if err != nil {
		return storedWorker{}, nil, err
	}
	index := workerIndex(workers, id)
	if index < 0 {
		return storedWorker{}, nil, errors.New("找不到指定的 Worker")
	}
	worker := workers[index]
	adapter, exists := s.registry.Get(worker.AdapterID)
	if !exists {
		return storedWorker{}, nil, errors.New("這個 Worker 的 adapter 已不存在")
	}
	generator, ok := adapter.(Generator)
	if !ok || !worker.Enabled || worker.Status != StatusOnline {
		return storedWorker{}, nil, errors.New("這個 Worker 尚未啟用、連線或提供可執行的 Job schema")
	}
	return worker, generator, nil
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

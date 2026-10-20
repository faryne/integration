// Package mediaworker 管理 Writer 可呼叫的媒體 Worker；Agent 只會看到能力摘要，不會接觸連線與密鑰。
package mediaworker

import "time"

const (
	StatusUnconfigured = "unconfigured"
	StatusOnline       = "online"
	StatusError        = "error"
)

// SettingField 由 adapter 宣告，前端依 schema render 設定欄位。
type SettingField struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Kind        string `json:"kind"`
	Required    bool   `json:"required"`
	Secret      bool   `json:"secret"`
	Placeholder string `json:"placeholder,omitempty"`
	Default     string `json:"default,omitempty"`
	// ItemWeight 只用於 Kind "catalog"：清單每一項另外帶 0～1 的權重（例如 LoRA）。
	ItemWeight bool `json:"item_weight,omitempty"`
}

// AdapterDescriptor 是 Registry 對 UI 公開的 adapter 能力與設定 schema。
type AdapterDescriptor struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	MediaTypes  []string       `json:"media_types"`
	Fields      []SettingField `json:"fields"`
}

// AgentCapability 是 Agent 唯一可見的 Worker 資料，不包含設定、endpoint、狀態細節或密鑰。
type AgentCapability struct {
	WorkerID     string   `json:"worker_id"`
	Name         string   `json:"name"`
	MediaTypes   []string `json:"media_types"`
	Capabilities []string `json:"capabilities"`
}

// WorkerOption 是提案視窗可顯示的安全選項；不暴露 endpoint、設定或密鑰。
type WorkerOption struct {
	WorkerID    string `json:"worker_id"`
	Name        string `json:"name"`
	Recommended bool   `json:"recommended"`
}

type JobOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// JobFieldCondition 讓共用動態表單依另一個欄位值顯示進階設定，不把 provider 規則寫死在前端。
type JobFieldCondition struct {
	Key    string   `json:"key"`
	Values []string `json:"values"`
}

// JobItemNumber 宣告 repeatable select 每列附帶的數值欄位，例如 LoRA 權重。
type JobItemNumber struct {
	Label   string  `json:"label"`
	Default float64 `json:"default"`
	Min     float64 `json:"min"`
	Max     float64 `json:"max"`
	Step    float64 `json:"step"`
}

// JobWeightedSelection 是 weighted_select 正規化後的單列資料。
type JobWeightedSelection struct {
	Value  string  `json:"value"`
	Weight float64 `json:"weight"`
}

// JobField 是 Worker discovery 回傳的動態表單欄位；Writer 依 schema 驗證後才執行。
type JobField struct {
	Key         string             `json:"key"`
	Label       string             `json:"label"`
	Kind        string             `json:"kind"`
	Description string             `json:"description,omitempty"`
	Required    bool               `json:"required"`
	Default     any                `json:"default,omitempty"`
	Min         *float64           `json:"min,omitempty"`
	Max         *float64           `json:"max,omitempty"`
	Step        *float64           `json:"step,omitempty"`
	Options     []JobOption        `json:"options,omitempty"`
	VisibleWhen *JobFieldCondition `json:"visible_when,omitempty"`
	ItemNumber  *JobItemNumber     `json:"item_number,omitempty"`
}

// JobSpec 是前端 render job 表單需要的安全資料，不含連線設定與密鑰。
type JobSpec struct {
	WorkerID   string     `json:"worker_id"`
	WorkerName string     `json:"worker_name"`
	Fields     []JobField `json:"fields"`
}

type GeneratedArtifact struct {
	LocalPath      string         `json:"local_path"`
	FileName       string         `json:"file_name"`
	MIMEType       string         `json:"mime_type"`
	AltText        string         `json:"alt_text,omitempty"`
	Description    string         `json:"description,omitempty"`
	ProviderJobID  string         `json:"provider_job_id,omitempty"`
	Model          string         `json:"model,omitempty"`
	Parameters     map[string]any `json:"parameters,omitempty"`
	CandidateGroup string         `json:"candidate_group,omitempty"`
	Width          int            `json:"width,omitempty"`
	Height         int            `json:"height,omitempty"`
}

type GenerateResult struct {
	Root      string
	Artifacts []GeneratedArtifact
	Request   *RequestAudit
}

// ExecutionPolicy 控制同一份媒體提案的錯峰派送；不暴露到提案表單，避免作者需要理解 provider 限流。
type ExecutionPolicy struct {
	LaunchInterval time.Duration
	MaxConcurrency int
}

var DefaultExecutionPolicy = ExecutionPolicy{LaunchInterval: 2 * time.Second, MaxConcurrency: 2}

// RequestAudit 保存實際送到 provider 的 method、endpoint 與 payload；認證 header 永遠不記錄。
type RequestAudit struct {
	Method   string         `json:"method"`
	Endpoint string         `json:"endpoint"`
	Payload  map[string]any `json:"payload,omitempty"`
}

func cloneAnyMap(input map[string]any) map[string]any {
	result := make(map[string]any, len(input))
	for key, value := range input {
		result[key] = value
	}
	return result
}

// Worker 是可重複建立的 adapter instance；Settings 永遠不含密鑰。
type Worker struct {
	ID            string            `json:"id"`
	AdapterID     string            `json:"adapter_id"`
	Name          string            `json:"name"`
	Enabled       bool              `json:"enabled"`
	Settings      map[string]string `json:"settings"`
	HasSecrets    map[string]bool   `json:"has_secrets"`
	Status        string            `json:"status"`
	StatusMessage string            `json:"status_message,omitempty"`
	Capabilities  []string          `json:"capabilities"`
	LastCheckedAt string            `json:"last_checked_at,omitempty"`
}

// SaveInput 的 Secrets 只在這次呼叫存在；空值代表保留已存內容，ClearSecrets 才會刪除。
type SaveInput struct {
	ID           string            `json:"id"`
	AdapterID    string            `json:"adapter_id"`
	Name         string            `json:"name"`
	Enabled      bool              `json:"enabled"`
	Settings     map[string]string `json:"settings"`
	Secrets      map[string]string `json:"secrets"`
	ClearSecrets []string          `json:"clear_secrets"`
}

type Discovery struct {
	Capabilities []string
	Message      string
}

type storedFile struct {
	Workers []storedWorker `json:"workers"`
}

type storedWorker struct {
	ID            string            `json:"id"`
	AdapterID     string            `json:"adapter_id"`
	Name          string            `json:"name"`
	Enabled       bool              `json:"enabled"`
	Settings      map[string]string `json:"settings"`
	Status        string            `json:"status"`
	StatusMessage string            `json:"status_message,omitempty"`
	Capabilities  []string          `json:"capabilities,omitempty"`
	LastCheckedAt time.Time         `json:"last_checked_at,omitempty"`
}

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

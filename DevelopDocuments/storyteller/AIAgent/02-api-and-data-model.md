# API 與資料模型

## 目標

整理 AI Agent 的建立、維護與執行 API 規格。此專案已經有 Agent CRUD 與 `storyteller_agents` 資料表，第一步不是重做 CRUD，而是 review 現況並補齊能支援 Agent run 的 contract。

## 既有 Agent CRUD 現況

目前後端已存在以下登入後 API：

| method | path | 用途 |
| --- | --- | --- |
| `GET` | `/storyteller/agents` | 列出目前使用者的 Agent |
| `POST` | `/storyteller/agents` | 建立 Agent |
| `GET` | `/storyteller/agents/:agent` | 取得單一 Agent |
| `PUT` | `/storyteller/agents/:agent` | 更新 Agent |
| `DELETE` | `/storyteller/agents/:agent` | 刪除 Agent |

既有 `AgentRequest` 欄位：

- `name`
- `provider`
- `model_name`
- `api_key`
- `default_prompt`

既有 `storyteller_agents` 欄位已包含：

- Agent 名稱
- 使用者 `user_id`
- AI provider
- model name
- API key
- default prompt
- soft delete 欄位

## Agent 維護補強項目

需要先 review 並確認以下行為：

- 建立 Agent 時 `api_key` 必填。
- 更新 Agent 時空白 `api_key` 代表不更新既有 key。
- Agent response 不可回傳 `api_key`。
- `provider` 第一版只允許 `grok`。
- `model_name` 由使用者輸入或前端選擇後送出；provider model list 不是第一版必要項目。
- `default_prompt` 是 Agent 的可重複使用能力設定，run 時必定納入 system prompt。
- 刪除行為應維持 soft delete。
- 前端應提供建立、編輯、刪除或停用狀態顯示；若要新增「測試連線」屬於 provider 維護延伸功能。

## Agent Run API

Agent run 是新 API，和 Agent CRUD 分開處理。建議路由掛在 story 底下，讓權限語意清楚：

```text
POST /storyteller/projects/:project/stories/:story/agents/:agent/run
```

其中：

- `:project` 使用 project public id。
- `:story` 使用 story public id。
- `:agent` 使用 agent numeric id。
- 後端需驗證 project、story、agent 都屬於目前登入使用者。

若後續需要支援不綁定 story 的 Agent 測試，可另開：

```text
POST /storyteller/agents/:agent/run
```

但第一版故事編輯器使用情境建議先要求 story context。

## Agent Run Request

建議在 `model/` 增加：

```go
type AgentRunMode string

const (
    AgentRunModeRewriteSelection   AgentRunMode = "rewrite_selection"
    AgentRunModeExpandSelection    AgentRunMode = "expand_selection"
    AgentRunModeTranslateSelection AgentRunMode = "translate_selection"
    AgentRunModeContinueChapter    AgentRunMode = "continue_chapter"
    AgentRunModeCustomSelection    AgentRunMode = "custom_selection"
    AgentRunModeCustomChapter      AgentRunMode = "custom_chapter"
)

type AgentRunRequest struct {
    Mode            AgentRunMode `json:"mode"`
    Instruction     string       `json:"instruction"`
    FullContent     string       `json:"full_content"`
    SelectedContent string       `json:"selected_content"`
    SelectionStart  *int         `json:"selection_start"`
    SelectionEnd    *int         `json:"selection_end"`
}
```

`story_public_id` 不需要放在 body，因為 route 已包含 `:story`。

## Agent Run Response

建議在 `model/` 增加：

```go
type AgentRunUsage struct {
    InputTokens  int `json:"input_tokens,omitempty"`
    OutputTokens int `json:"output_tokens,omitempty"`
    TotalTokens  int `json:"total_tokens,omitempty"`
}

type AgentRunResponse struct {
    AgentID      uint64            `json:"agent_id"`
    Provider     AgentProvider     `json:"provider"`
    ModelName    string            `json:"model_name"`
    Mode         AgentRunMode      `json:"mode"`
    Result       string            `json:"result"`
    Usage        *AgentRunUsage    `json:"usage,omitempty"`
    FinishReason string            `json:"finish_reason,omitempty"`
}
```

## 驗證規則

- `instruction` trim 後不可空白。
- `mode` 必須是允許值。
- selection mode 必須有 `selected_content`、`selection_start`、`selection_end`。
- chapter mode 必須有 `full_content`，允許空章節但不能省略欄位語意。
- `selection_start` 必須小於 `selection_end`。
- `full_content` 與 `selected_content` 需要限制長度，實際上限放到安全性文件決定。
- Agent 不存在、已刪除或不屬於使用者時回 404 或權限錯誤。
- Story 不存在、已刪除或不屬於使用者時回 404 或權限錯誤。

## 執行紀錄與 Migration

第一版 Agent run 不強制新增資料表。若要保存執行紀錄，應延伸 `09-execution-history-and-usage.md`，再決定是否新增 migration。

目前建議：

- 不先保存完整故事全文與 AI 回應。
- 可以在 provider response 中回傳 usage 給前端顯示或 debug。
- 若之後需要歷史紀錄，再新增 `storyteller_agent_runs` 或沿用 chat tables。

## 注意事項

- migration 放在 `migration/`，且需相容 MySQL 5.7.x。
- Controller 使用 `faryne.dev/service/output` 作為標準 API response。
- Controller 保持 thin handler，權限、prompt 組合與 provider 呼叫放在 service。

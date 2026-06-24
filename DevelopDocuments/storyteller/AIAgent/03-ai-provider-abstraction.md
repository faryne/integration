# AI Provider 抽象層

## 目標

在後端建立可替換 AI 供應商的邊界。目前優先支援 Grok，並保留未來接入其他 provider 的能力。Provider 設定來源必須來自後端已保存的 Agent 維護資料，前端執行 run 時不得傳 API key。

## Provider 設定來源

Agent 建立與維護已保存以下 provider 相關設定：

- `provider`
- `model_name`
- `api_key`
- `default_prompt`

Agent run 時流程應為：

1. Service 依目前登入使用者查出 Agent。
2. Service 驗證 Agent 未刪除且屬於該使用者。
3. Service 從 Agent 取得 provider、model name、API key、default prompt。
4. Service 組合 system/user prompt。
5. Service 依 provider 建立對應 client 並送出 request。

前端只能指定要使用哪個 Agent 與這次的 run input，不可覆寫 provider、model name 或 API key。

## Provider Interface

建議在 `service/storyteller` 或其子 package 定義 provider interface：

```go
type AIProvider interface {
    Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error)
}

type AIProviderRequest struct {
    APIKey       string
    ModelName    string
    SystemPrompt string
    UserPrompt   string
}

type AIProviderResponse struct {
    Result       string
    Usage        *AIProviderUsage
    FinishReason string
}

type AIProviderUsage struct {
    InputTokens  int
    OutputTokens int
    TotalTokens  int
}
```

`APIKey` 不應出現在 controller response、log 或 error message 中。

## Provider Factory

建議建立 provider factory，依 Agent 的 `provider` 回傳具體實作：

```go
func NewAIProvider(provider storytellerModel.AgentProvider) (AIProvider, error)
```

第一版：

- `grok` 回傳 Grok provider。
- 未支援 provider 回傳 validation error。

未來新增 provider 時，只需要新增 provider 實作與 factory 分支，Agent run service 不應散落 provider-specific 邏輯。

## Grok Provider

第一版 Grok provider 需要統一處理：

- API endpoint。
- request body 結構。
- model name。
- authorization header。
- timeout。
- response result 解析。
- usage 解析。
- finish reason 解析。
- provider error 解析。

Grok provider 對外只回傳系統內部的 `AIProviderResponse` 或標準化錯誤，不讓上層 service 依賴 Grok 原始 response schema。

## Agent 維護延伸功能

以下屬於 Agent 建立與維護的 provider 相關延伸項目，不阻塞第一版 run：

- 測試 API key 是否可用。
- 依 provider 取得 model list。
- 儲存 provider-specific options，例如 temperature、max tokens。
- 支援使用者停用 Agent。
- 支援 key rotation 或重新輸入 API key。

若要實作「測試連線」，建議新增獨立 API：

```text
POST /storyteller/agents/:agent/test
```

此 API 同樣從後端 Agent 設定取 API key，不接受前端直接傳 key，除非是建立頁尚未保存前的測試情境；該情境需要另行設計安全規則。

## 錯誤格式

Provider 層應把外部錯誤轉為上層可判斷的類型：

- invalid api key
- rate limited
- timeout
- provider unavailable
- invalid model
- empty result
- unknown provider error

Service 再決定如何轉成 API response。Provider 原始錯誤內容若包含 request body、API key 或敏感 header，不可直接回傳前端。

## 測試重點

- Provider factory 對 `grok` 回傳正確實作。
- Provider factory 對未知 provider 回傳錯誤。
- Grok provider 成功時轉換為系統內部 response。
- Grok provider 回傳錯誤時轉換為一致錯誤格式。
- Timeout 或 rate limit 能被上層 service 正確處理。
- Agent run 不接受前端覆寫 API key、provider 或 model name。

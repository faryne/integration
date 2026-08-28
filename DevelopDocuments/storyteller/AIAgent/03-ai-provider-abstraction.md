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

## 各 Provider 生成參數盤點（2026-08-27，與 Codex 討論）

起因：`ClaudeProvider` 的 `max_tokens` 原本寫死 4096（`service/storyteller/ai_provider.go:471`），thinking token 跟輸出文字共用同一個額度，稍微多想就被截斷（`stop_reason=max_tokens`），導致 agent loop 一直重試。已先把常數調到 8192 應急，這裡記錄後續要不要做成可設定參數的盤點結論，供之後開分支實作時參考。這只是討論結論，尚未動工。

**現況**：`AIProviderRequest`（`ai_provider.go:45`）完全沒有生成參數欄位。三條 provider 路徑各自處理程度不同：

- **ClaudeProvider**（`claudeMessageRequest`，`ai_provider.go:526`）：唯一有 `MaxTokens`，但寫死常數，呼叫端傳不進來。
- **generateOpenAICompatible**（`openAIChatCompletionRequest`，`ai_provider.go:391`，Grok/OpenAI/OpenRouter/self-hosted 共用）：完全沒送 `max_tokens`，吃各家伺服器預設值。
- **GeminiProvider**（`geminiGenerateContentRequest`，`ai_provider.go:751`）：完全沒有 `generationConfig`，同樣吃預設值。

**各 provider 原生支援**（Anthropic Messages API / OpenAI Chat Completions / xAI Grok / OpenRouter / Google Gemini 官方文件）：

- Claude：`max_tokens`、`stop_sequences`、`tool_choice`、`thinking`/`budget_tokens`（budget 必須小於 max_tokens）。`temperature/top_p/top_k` 已 deprecated，新模型可能拒絕非預設值。
- OpenAI 官方：`max_completion_tokens`（已取代舊的 `max_tokens`，內含 reasoning tokens）、`temperature/top_p/stop/presence_penalty/frequency_penalty/reasoning_effort/verbosity/tool_choice`。
- Grok（xAI）：走 `/v1/chat/completions`（legacy 定位），reasoning model 支援 `reasoning_effort`（預設偏高、無法關閉），且 reasoning model 不支援 `presence_penalty/frequency_penalty/stop`。
- OpenRouter：依 model 宣告 `supported_parameters` 不同，常見 `max_tokens/max_completion_tokens/temperature/top_p/stop/seed/reasoning`（統一用 `reasoning.effort` 或 `reasoning.max_tokens`），另有 gateway 專屬的 `top_k/min_p/top_a/repetition_penalty`。
- self-hosted：只能假設是 OpenAI-compatible 子集，`max_tokens` 通常比 `max_completion_tokens` 更常被 vLLM/Ollama-compatible server 接受，但無法保證。
- Gemini：`generationConfig.maxOutputTokens/temperature/topP/topK/stopSequences/candidateCount/seed`；thinking 用 `thinkingConfig`（Gemini 3 為 `thinkingLevel`，2.5 為 `thinkingBudget`），thinking tokens 在 usage 裡通常獨立計，但仍佔用整體生成預算。

**建議的統一層設計**：不要把欄位直接攤平進 `AIProviderRequest`，改成一個 shared `GenerationConfig` 結構掛進去，各 provider adapter 自己做 mapping：

- 建議先統一：`MaxOutputTokens`（必做，直接對應這次的 bug）、`ReasoningEffort`（用 `off/low/medium/high` 抽象層包一次，因為 Claude/Gemini 是 token budget、OpenAI/Grok 是 effort 等級，語意單位不同不能硬套同一個數字）。
- 建議先不統一（維持 provider-specific 或先不開放）：`temperature/top_p/top_k`（Claude 已 deprecated、reasoning model 常直接拒絕自訂值）、`stop_sequences`（部分 reasoning model 不支援）、exact thinking budget token 數、`presence_penalty/frequency_penalty/repetition_penalty/seed/logprobs/response_format/verbosity/tool_choice/parallel_tool_calls`。
- Orchestration 層既有的 `MaxSteps`／`MaxDuration`（`agent_loop.go:24`、`agent_loop.go:27`）已經做成可設定欄位，但呼叫端（`runStoryAgenticQuery` 等）目前沒有真的傳自訂值進來，是現成可以優先開放使用者調整的項目，建議範圍 `MaxSteps` 1–12、`MaxDuration` 1–15 分鐘。

**建議的安全預設值**（若之後做使用者可調整 UI）：

- `MaxOutputTokens`：agentic query 預設 16384，單輪 skill（改寫/擴寫/翻譯）預設 8192，UI 提供 `8192/16384/32768` 幾檔，送出前依 model/provider 已知上限 clamp。
- `ReasoningEffort`：agentic/tool-calling 預設 `low`，單輪創作 skill 預設 `off`；規則是 thinking budget 不該超過 `MaxOutputTokens` 的一半，避免又重演這次的截斷問題。
- 不建議先開放：`temperature/top_p/top_k/penalties/seed/stop/logprobs`，容易踩到 provider/model 不相容而直接報錯，且不直接解決 truncation 問題；要開也應該放在「進階設定」，預設一律留空（不要送看似安全實則危險的值，例如 `0.7`）。

**已知缺口**：`storyteller_agent_models`（`model/entity/storyteller/storyteller.go:345`）目前只存 name/label/description/price，沒有存每個 model 的 output cap／是否支援 reasoning 之類的 capability metadata，之後要做「依 model 自動 clamp 上限」或選單會需要先補這塊。另外 Claude/Gemini 的 thinking block／reasoning signature 若要在多輪 tool loop 裡延續，目前共用的 `Message`（`ai_provider.go:94`）只有純文字跟 tool call，承載不了這類 provider-native reasoning 內容，是開放 `ReasoningEffort` 時要一併考慮的架構限制。

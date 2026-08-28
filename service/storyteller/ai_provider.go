package storyteller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	defaultGrokChatCompletionsURL       = "https://api.x.ai/v1/chat/completions"
	defaultOpenAIChatCompletionsURL     = "https://api.openai.com/v1/chat/completions"
	defaultClaudeMessagesURL            = "https://api.anthropic.com/v1/messages"
	defaultGeminiGenerateContentBaseURL = "https://generativelanguage.googleapis.com/v1beta/models"
	defaultOpenRouterChatCompletionsURL = "https://openrouter.ai/api/v1/chat/completions"
)

var (
	ErrAIProviderInvalidAPIKey   = errors.New("ai provider api key is invalid")
	ErrAIProviderRateLimited     = errors.New("ai provider rate limited")
	ErrAIProviderTimeout         = errors.New("ai provider timeout")
	ErrAIProviderUnavailable     = errors.New("ai provider unavailable")
	ErrAIProviderInvalidModel    = errors.New("ai provider model is invalid")
	ErrAIProviderEmptyResult     = errors.New("ai provider returned empty result")
	ErrAIProviderUnknown         = errors.New("ai provider error")
	ErrAIProviderUnsupported     = errors.New("ai provider is not supported")
	ErrAIProviderMissingEndpoint = errors.New("ai provider endpoint is required")
)

type AIProvider interface {
	Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error)
}

// AIProviderRequest 的 Tools／Messages 是 Phase 2（agentic tool-calling）新增的欄位，
// 純粹加法擴充：兩者都留空時，行為跟擴充前完全一樣（走 SystemPrompt/UserPrompt 單輪
// 模式），現有呼叫端（runAgent／skill 式改寫擴寫等單輪功能）不用改一行就能繼續動。
type AIProviderRequest struct {
	APIKey       string
	ModelName    string
	SystemPrompt string
	UserPrompt   string
	// Tools 非空時代表這次呼叫允許 provider 主動要求呼叫工具（tool-calling／
	// function-calling）。各 provider 會轉成自己的 native wire format；呼叫端
	// 只需要看 AIProviderResponse.ToolCalls。
	Tools []ToolDefinition
	// Messages 非空時取代 SystemPrompt/UserPrompt，用來支援多輪對話／
	// tool-calling loop（agent 呼叫工具、把結果餵回去再問一次）。
	Messages []Message
}

type AIProviderResponse struct {
	Result string
	Usage  *AIProviderUsage
	// ToolCalls 非空代表 provider 這一輪要求呼叫工具，而不是給出最終文字答案。
	// Result 在這種情況下可能是空字串（模型只回工具呼叫、沒有附帶文字），呼叫
	// 這個 SDK 的人要先檢查 ToolCalls 再決定要不要把 Result 當成最終答案。
	ToolCalls    []ToolCall
	FinishReason string
	// RawBody 是這次 provider 呼叫收到的原始 HTTP response body，一個字元都
	// 沒有精簡或改動——純粹留給事後除錯／追查用（例如比對跟 provider 自己
	// console 上的紀錄是否對得上），正常業務邏輯不應該依賴這個欄位，該解析的
	// 資訊上面幾個欄位都已經處理好了。
	RawBody string
}

// ToolDefinition 描述一個可以被 provider 呼叫的工具，格式直接對應
// service/storyteller/tool_registry.go 的 ToolSpec（Name/Description/
// InputSchema），呼叫端把 ToolSpec 轉成 ToolDefinition 餵進來即可，兩邊故意用
// 同樣的欄位形狀，不需要額外轉換邏輯。
type ToolDefinition struct {
	Name        string
	Description string
	InputSchema map[string]interface{}
}

// Message 是多輪對話裡的一則訊息。Role 是 "user"／"assistant"／"tool" 三種之一：
//   - "user"／"assistant"：一般對話輪次，Content 是純文字。
//   - "assistant" 且 ToolCalls 非空：這則訊息代表 provider 要求呼叫工具（Content
//     可能同時有文字，也可能是空字串，視 provider 而定）。
//   - "tool"：回報某一次 ToolCall 的執行結果，ToolCallID 對應到前一則 assistant
//     訊息裡 ToolCalls 其中一個的 ID，Content 是工具執行結果（通常是 JSON 文字）。
type Message struct {
	Role       string
	Content    string
	ToolCallID string
	ToolCalls  []ToolCall
}

// ToolCall 是 provider 回傳的一次工具呼叫請求，或是（塞進 Message.ToolCalls 時）
// 呼叫端要回報給 provider「這次對話曾經要求呼叫過這個工具」的記錄。
type ToolCall struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

type AIProviderUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

const (
	// aiProviderDefaultTimeout 是單輪 skill（改寫/擴寫/翻譯）用的逾時——單輪呼叫
	// 通常幾秒到十幾秒內就回來，這個值原本就是照這個情境訂的。
	aiProviderDefaultTimeout = 60 * time.Second
	// aiProviderAgenticTimeout 給 AAS 多輪 tool-calling 迴圈用。同一個 60 秒是為
	// 單輪設計的，AAS 每一步都要先讀前面工具回傳的資料再組織回應，單步耗時本來
	// 就比單輪高，沿用同一個值很容易誤傷正常但比較慢的一步；獨立拉高，不影響
	// 單輪 skill 那條路徑。
	aiProviderAgenticTimeout = 180 * time.Second
)

// endpoint 只有 self-hosted provider 會用到（自架的 OpenAI 相容 API 位址），
// 其餘固定 provider 一律沿用各自的預設常數，忽略傳入值。
func NewAIProvider(provider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
	return newAIProviderWithTimeout(provider, endpoint, aiProviderDefaultTimeout)
}

// NewAgenticAIProvider 是 AAS（多輪 tool-calling）專用的 provider 工廠，唯一差異
// 是逾時時間，見 aiProviderAgenticTimeout 的說明。
func NewAgenticAIProvider(provider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
	return newAIProviderWithTimeout(provider, endpoint, aiProviderAgenticTimeout)
}

func newAIProviderWithTimeout(provider storytellerModel.AgentProvider, endpoint string, timeout time.Duration) (AIProvider, error) {
	httpClient := &http.Client{Timeout: timeout}
	switch provider {
	case storytellerModel.AgentProviderGrok:
		return NewGrokProvider(defaultGrokChatCompletionsURL, httpClient), nil
	case storytellerModel.AgentProviderOpenAI:
		return NewOpenAICompatibleProvider(defaultOpenAIChatCompletionsURL, httpClient), nil
	case storytellerModel.AgentProviderOpenRouter:
		return NewOpenAICompatibleProvider(defaultOpenRouterChatCompletionsURL, httpClient), nil
	case storytellerModel.AgentProviderClaude:
		return NewClaudeProvider(defaultClaudeMessagesURL, httpClient), nil
	case storytellerModel.AgentProviderGemini:
		return NewGeminiProvider(defaultGeminiGenerateContentBaseURL, httpClient), nil
	case storytellerModel.AgentProviderSelfHosted:
		if strings.TrimSpace(endpoint) == "" {
			return nil, ErrAIProviderMissingEndpoint
		}
		return NewOpenAICompatibleProvider(strings.TrimSpace(endpoint), httpClient), nil
	default:
		return nil, ErrAIProviderUnsupported
	}
}

type GrokProvider struct {
	endpoint   string
	httpClient *http.Client
}

func NewGrokProvider(endpoint string, httpClient *http.Client) *GrokProvider {
	if strings.TrimSpace(endpoint) == "" {
		endpoint = defaultGrokChatCompletionsURL
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &GrokProvider{endpoint: endpoint, httpClient: httpClient}
}

func (p *GrokProvider) Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	return generateOpenAICompatible(ctx, p.endpoint, p.httpClient, req)
}

type OpenAICompatibleProvider struct {
	endpoint   string
	httpClient *http.Client
}

func NewOpenAICompatibleProvider(endpoint string, httpClient *http.Client) *OpenAICompatibleProvider {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &OpenAICompatibleProvider{endpoint: endpoint, httpClient: httpClient}
}

func (p *OpenAICompatibleProvider) Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	return generateOpenAICompatible(ctx, p.endpoint, p.httpClient, req)
}

func generateOpenAICompatible(ctx context.Context, endpoint string, httpClient *http.Client, req AIProviderRequest) (*AIProviderResponse, error) {
	if strings.TrimSpace(req.APIKey) == "" {
		return nil, ErrAIProviderInvalidAPIKey
	}
	if strings.TrimSpace(req.ModelName) == "" {
		return nil, ErrAIProviderInvalidModel
	}
	body, err := json.Marshal(openAIChatCompletionRequest{
		Model:    req.ModelName,
		Messages: buildOpenAIMessages(req),
		Tools:    buildOpenAITools(req.Tools),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: encode request failed", ErrAIProviderUnknown)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request failed", ErrAIProviderUnknown)
	}
	httpReq.Header.Set("Authorization", "Bearer "+strings.TrimSpace(req.APIKey))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ErrAIProviderTimeout
		}
		return nil, fmt.Errorf("%w: request failed", ErrAIProviderUnavailable)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, aiProviderStatusError(resp.StatusCode, resp.Body)
	}

	// 用 io.ReadAll 先把原始 body 讀出來、留一份不動的副本，再用 json.Unmarshal
	// 解析——不能直接 json.NewDecoder(resp.Body).Decode()，那個會把 body 直接
	// 吃掉，沒有機會留下未經任何精簡/改動的原文（見 AIProviderResponse.RawBody
	// 的說明，純粹給除錯用）。
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read response failed", ErrAIProviderUnknown)
	}
	var output openAIChatCompletionResponse
	if err := json.Unmarshal(rawBody, &output); err != nil {
		return nil, fmt.Errorf("%w: decode response failed", ErrAIProviderUnknown)
	}
	if len(output.Choices) == 0 {
		return nil, ErrAIProviderEmptyResult
	}
	message := output.Choices[0].Message
	toolCalls := toGenericToolCalls(message.ToolCalls)
	result := strings.TrimSpace(message.Content)
	// 只有工具呼叫、沒有文字答案是合法的（模型這一輪只想呼叫工具），此時不能
	// 當成「空結果」拒絕；只有兩者都是空的才是真的沒拿到任何有用回應。
	if result == "" && len(toolCalls) == 0 {
		return nil, ErrAIProviderEmptyResult
	}
	return &AIProviderResponse{
		Result:       result,
		ToolCalls:    toolCalls,
		FinishReason: output.Choices[0].FinishReason,
		Usage: &AIProviderUsage{
			InputTokens:  output.Usage.PromptTokens,
			OutputTokens: output.Usage.CompletionTokens,
			TotalTokens:  output.Usage.TotalTokens,
		},
		RawBody: string(rawBody),
	}, nil
}

// buildOpenAIMessages 有 Messages（多輪／tool-calling loop）就用它，否則走原本
// 的 system+user 單輪組法——確保沒有填 Messages 的既有呼叫端（runAgent）產生的
// request body 跟擴充前逐位元組相同。
func buildOpenAIMessages(req AIProviderRequest) []openAIChatMessage {
	if len(req.Messages) == 0 {
		return []openAIChatMessage{
			{Role: "system", Content: req.SystemPrompt},
			{Role: "user", Content: req.UserPrompt},
		}
	}
	messages := make([]openAIChatMessage, 0, len(req.Messages)+1)
	if strings.TrimSpace(req.SystemPrompt) != "" {
		messages = append(messages, openAIChatMessage{Role: "system", Content: req.SystemPrompt})
	}
	for _, m := range req.Messages {
		messages = append(messages, openAIChatMessage{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
			ToolCalls:  toOpenAIToolCalls(m.ToolCalls),
		})
	}
	return messages
}

func buildOpenAITools(tools []ToolDefinition) []openAIToolDefinition {
	if len(tools) == 0 {
		return nil
	}
	out := make([]openAIToolDefinition, 0, len(tools))
	for _, t := range tools {
		out = append(out, openAIToolDefinition{
			Type: "function",
			Function: openAIFunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.InputSchema,
			},
		})
	}
	return out
}

func toOpenAIToolCalls(calls []ToolCall) []openAIToolCall {
	if len(calls) == 0 {
		return nil
	}
	out := make([]openAIToolCall, 0, len(calls))
	for _, c := range calls {
		arguments, _ := json.Marshal(c.Arguments)
		out = append(out, openAIToolCall{
			ID:   c.ID,
			Type: "function",
			Function: openAIToolCallFunction{
				Name:      c.Name,
				Arguments: string(arguments),
			},
		})
	}
	return out
}

// toGenericToolCalls 把 OpenAI 回傳的 tool_calls（Arguments 是 JSON 編碼過的
// 字串）轉成統一格式（Arguments 是解析過的 map）。單一 tool call 的 Arguments
// 解析失敗時，該筆改用空 map 而不是整批放棄——避免一個工具呼叫的參數壞掉，
// 拖累同一輪其他正常的工具呼叫也一起不見。
func toGenericToolCalls(calls []openAIToolCall) []ToolCall {
	if len(calls) == 0 {
		return nil
	}
	out := make([]ToolCall, 0, len(calls))
	for _, c := range calls {
		var args map[string]interface{}
		_ = json.Unmarshal([]byte(c.Function.Arguments), &args)
		out = append(out, ToolCall{ID: c.ID, Name: c.Function.Name, Arguments: args})
	}
	return out
}

func aiProviderStatusError(statusCode int, body io.Reader) error {
	message := sanitizeProviderErrorMessage(body)
	var base error
	switch statusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		base = ErrAIProviderInvalidAPIKey
	case http.StatusTooManyRequests:
		base = ErrAIProviderRateLimited
	case http.StatusBadRequest, http.StatusNotFound:
		base = ErrAIProviderInvalidModel
	case http.StatusRequestTimeout, http.StatusGatewayTimeout:
		base = ErrAIProviderTimeout
	case http.StatusBadGateway, http.StatusServiceUnavailable:
		base = ErrAIProviderUnavailable
	default:
		base = ErrAIProviderUnknown
	}
	if message == "" {
		return base
	}
	return fmt.Errorf("%w: %s", base, message)
}

func sanitizeProviderErrorMessage(body io.Reader) string {
	data, err := io.ReadAll(io.LimitReader(body, 2048))
	if err != nil {
		return ""
	}
	var payload struct {
		Error any `json:"error"`
	}
	if err := json.Unmarshal(data, &payload); err == nil && payload.Error != nil {
		switch value := payload.Error.(type) {
		case string:
			return strings.TrimSpace(value)
		case map[string]any:
			if message, ok := value["message"].(string); ok {
				return strings.TrimSpace(message)
			}
		}
	}
	return strings.TrimSpace(string(data))
}

type openAIChatCompletionRequest struct {
	Model    string                 `json:"model"`
	Messages []openAIChatMessage    `json:"messages"`
	Tools    []openAIToolDefinition `json:"tools,omitempty"`
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	// ToolCalls／ToolCallID 只有多輪 tool-calling 對話才會用到：ToolCalls 是
	// role="assistant" 這則訊息當初要求呼叫的工具列表；ToolCallID 是
	// role="tool" 這則訊息在回報哪一次呼叫的結果，兩者互斥。
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
}

type openAIToolDefinition struct {
	Type     string                   `json:"type"`
	Function openAIFunctionDefinition `json:"function"`
}

type openAIFunctionDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

type openAIToolCall struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Function openAIToolCallFunction `json:"function"`
}

type openAIToolCallFunction struct {
	Name string `json:"name"`
	// Arguments 是 OpenAI 相容 API 的既定格式：JSON 編碼過的字串，不是巢狀
	// object——所有 OpenAI-compatible 供應商（OpenAI／Grok／OpenRouter／
	// Self-hosted）都遵循這個格式。
	Arguments string `json:"arguments"`
}

type openAIChatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content   string           `json:"content"`
			ToolCalls []openAIToolCall `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

type ClaudeProvider struct {
	endpoint   string
	httpClient *http.Client
}

func NewClaudeProvider(endpoint string, httpClient *http.Client) *ClaudeProvider {
	if strings.TrimSpace(endpoint) == "" {
		endpoint = defaultClaudeMessagesURL
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &ClaudeProvider{endpoint: endpoint, httpClient: httpClient}
}

func (p *ClaudeProvider) Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	if strings.TrimSpace(req.APIKey) == "" {
		return nil, ErrAIProviderInvalidAPIKey
	}
	if strings.TrimSpace(req.ModelName) == "" {
		return nil, ErrAIProviderInvalidModel
	}
	body, err := json.Marshal(claudeMessageRequest{
		Model:     req.ModelName,
		MaxTokens: 8192,
		System:    req.SystemPrompt,
		Messages:  buildClaudeMessages(req),
		Tools:     buildClaudeTools(req.Tools),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: encode request failed", ErrAIProviderUnknown)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request failed", ErrAIProviderUnknown)
	}
	httpReq.Header.Set("x-api-key", strings.TrimSpace(req.APIKey))
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ErrAIProviderTimeout
		}
		return nil, fmt.Errorf("%w: request failed", ErrAIProviderUnavailable)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, aiProviderStatusError(resp.StatusCode, resp.Body)
	}
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read response failed", ErrAIProviderUnknown)
	}
	var output claudeMessageResponse
	if err := json.Unmarshal(rawBody, &output); err != nil {
		return nil, fmt.Errorf("%w: decode response failed", ErrAIProviderUnknown)
	}
	result := strings.TrimSpace(output.JoinedText())
	toolCalls := output.ToolCalls()
	if result == "" && len(toolCalls) == 0 {
		return nil, ErrAIProviderEmptyResult
	}
	return &AIProviderResponse{
		Result:    result,
		ToolCalls: toolCalls,
		Usage: &AIProviderUsage{
			InputTokens:  output.Usage.InputTokens,
			OutputTokens: output.Usage.OutputTokens,
			TotalTokens:  output.Usage.InputTokens + output.Usage.OutputTokens,
		},
		FinishReason: output.StopReason,
		RawBody:      string(rawBody),
	}, nil
}

type claudeMessageRequest struct {
	Model     string                 `json:"model"`
	MaxTokens int                    `json:"max_tokens"`
	System    string                 `json:"system"`
	Messages  []claudeMessage        `json:"messages"`
	Tools     []claudeToolDefinition `json:"tools,omitempty"`
}

// claudeMessage.Content 統一用 content block 陣列表示（Claude API 的 content
// 欄位本來就同時接受純字串或 block 陣列，這裡固定只用陣列形式，單輪的舊呼叫
// 路徑也包成單一 text block，讓 request 組法不用因為有沒有 tools 分兩套）。
type claudeMessage struct {
	Role    string               `json:"role"`
	Content []claudeContentBlock `json:"content"`
}

// claudeContentBlock 是 Claude content 陣列裡的其中一項，依 Type 決定哪些欄位
// 有意義：
//   - "text"：Text 有值。
//   - "tool_use"（assistant 訊息要求呼叫工具）：ID／Name／Input 有值。
//   - "tool_result"（user 訊息回報工具執行結果）：ToolUseID／Content 有值。
type claudeContentBlock struct {
	Type      string      `json:"type"`
	Text      string      `json:"text,omitempty"`
	ID        string      `json:"id,omitempty"`
	Name      string      `json:"name,omitempty"`
	Input     interface{} `json:"input,omitempty"`
	ToolUseID string      `json:"tool_use_id,omitempty"`
	Content   string      `json:"content,omitempty"`
}

type claudeToolDefinition struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	// Claude 的工具 schema 欄位叫 input_schema，跟 OpenAI 的 parameters 不同名，
	// 內容格式（JSON Schema）一樣，直接沿用 ToolDefinition.InputSchema。
	InputSchema map[string]interface{} `json:"input_schema"`
}

type claudeMessageResponse struct {
	Content    []claudeContentBlock `json:"content"`
	StopReason string               `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

func (r claudeMessageResponse) JoinedText() string {
	parts := make([]string, 0, len(r.Content))
	for _, item := range r.Content {
		if item.Type == "text" && strings.TrimSpace(item.Text) != "" {
			parts = append(parts, strings.TrimSpace(item.Text))
		}
	}
	return strings.Join(parts, "\n\n")
}

// ToolCalls 抓出這次回應裡的 tool_use content block，轉成統一格式。Input 在
// Claude API 本來就是解析好的 JSON object（不像 OpenAI 是字串），直接 type
// assert 成 map；assert 失敗（理論上不會發生，防禦性處理）就給空 map。
func (r claudeMessageResponse) ToolCalls() []ToolCall {
	var calls []ToolCall
	for _, item := range r.Content {
		if item.Type != "tool_use" {
			continue
		}
		args, _ := item.Input.(map[string]interface{})
		if args == nil {
			args = map[string]interface{}{}
		}
		calls = append(calls, ToolCall{ID: item.ID, Name: item.Name, Arguments: args})
	}
	return calls
}

// buildClaudeMessages 有 Messages 就轉譯成 Claude 的多輪＋tool_use/tool_result
// 格式，否則走原本的單輪單一 user text block 組法（既有呼叫端不受影響）。
func buildClaudeMessages(req AIProviderRequest) []claudeMessage {
	if len(req.Messages) == 0 {
		return []claudeMessage{{
			Role:    "user",
			Content: []claudeContentBlock{{Type: "text", Text: req.UserPrompt}},
		}}
	}
	messages := make([]claudeMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		switch {
		case m.Role == "tool":
			// Claude 沒有獨立的 "tool" role，tool_result 要包成 user 訊息的
			// content block。
			messages = append(messages, claudeMessage{
				Role: "user",
				Content: []claudeContentBlock{{
					Type:      "tool_result",
					ToolUseID: m.ToolCallID,
					Content:   m.Content,
				}},
			})
		case len(m.ToolCalls) > 0:
			blocks := make([]claudeContentBlock, 0, len(m.ToolCalls)+1)
			if strings.TrimSpace(m.Content) != "" {
				blocks = append(blocks, claudeContentBlock{Type: "text", Text: m.Content})
			}
			for _, call := range m.ToolCalls {
				blocks = append(blocks, claudeContentBlock{
					Type:  "tool_use",
					ID:    call.ID,
					Name:  call.Name,
					Input: call.Arguments,
				})
			}
			messages = append(messages, claudeMessage{Role: m.Role, Content: blocks})
		default:
			messages = append(messages, claudeMessage{
				Role:    m.Role,
				Content: []claudeContentBlock{{Type: "text", Text: m.Content}},
			})
		}
	}
	return messages
}

func buildClaudeTools(tools []ToolDefinition) []claudeToolDefinition {
	if len(tools) == 0 {
		return nil
	}
	out := make([]claudeToolDefinition, 0, len(tools))
	for _, t := range tools {
		out = append(out, claudeToolDefinition{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.InputSchema,
		})
	}
	return out
}

type GeminiProvider struct {
	baseURL    string
	httpClient *http.Client
}

func NewGeminiProvider(baseURL string, httpClient *http.Client) *GeminiProvider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultGeminiGenerateContentBaseURL
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 60 * time.Second}
	}
	return &GeminiProvider{baseURL: strings.TrimRight(baseURL, "/"), httpClient: httpClient}
}

func (p *GeminiProvider) Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	if strings.TrimSpace(req.APIKey) == "" {
		return nil, ErrAIProviderInvalidAPIKey
	}
	if strings.TrimSpace(req.ModelName) == "" {
		return nil, ErrAIProviderInvalidModel
	}
	body, err := json.Marshal(geminiGenerateContentRequest{
		SystemInstruction: geminiContent{
			Parts: []geminiPart{{Text: req.SystemPrompt}},
		},
		Contents: buildGeminiContents(req),
		Tools:    buildGeminiTools(req.Tools),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: encode request failed", ErrAIProviderUnknown)
	}
	endpoint := fmt.Sprintf("%s/%s:generateContent?key=%s", p.baseURL, url.PathEscape(strings.TrimSpace(req.ModelName)), url.QueryEscape(strings.TrimSpace(req.APIKey)))
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request failed", ErrAIProviderUnknown)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return nil, ErrAIProviderTimeout
		}
		return nil, fmt.Errorf("%w: request failed", ErrAIProviderUnavailable)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, aiProviderStatusError(resp.StatusCode, resp.Body)
	}
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read response failed", ErrAIProviderUnknown)
	}
	var output geminiGenerateContentResponse
	if err := json.Unmarshal(rawBody, &output); err != nil {
		return nil, fmt.Errorf("%w: decode response failed", ErrAIProviderUnknown)
	}
	result := strings.TrimSpace(output.JoinedText())
	toolCalls := output.ToolCalls()
	// Gemini 可能只回 functionCall、沒有文字；這是合法的中間輪次，不是空結果。
	if result == "" && len(toolCalls) == 0 {
		return nil, ErrAIProviderEmptyResult
	}
	return &AIProviderResponse{
		Result:    result,
		ToolCalls: toolCalls,
		Usage: &AIProviderUsage{
			InputTokens:  output.UsageMetadata.PromptTokenCount,
			OutputTokens: output.UsageMetadata.CandidatesTokenCount,
			TotalTokens:  output.UsageMetadata.TotalTokenCount,
		},
		FinishReason: output.FinishReason(),
		RawBody:      string(rawBody),
	}, nil
}

type geminiGenerateContentRequest struct {
	SystemInstruction geminiContent   `json:"system_instruction"`
	Contents          []geminiContent `json:"contents"`
	Tools             []geminiTool    `json:"tools,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text             string                  `json:"text,omitempty"`
	FunctionCall     *geminiFunctionCall     `json:"functionCall,omitempty"`
	FunctionResponse *geminiFunctionResponse `json:"functionResponse,omitempty"`
}

type geminiTool struct {
	FunctionDeclarations []geminiFunctionDeclaration `json:"functionDeclarations,omitempty"`
}

type geminiFunctionDeclaration struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

type geminiFunctionCall struct {
	ID   string                 `json:"id,omitempty"`
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args,omitempty"`
}

type geminiFunctionResponse struct {
	ID       string                 `json:"id,omitempty"`
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

type geminiGenerateContentResponse struct {
	Candidates []struct {
		Content      geminiContent `json:"content"`
		FinishReason string        `json:"finishReason"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		TotalTokenCount      int `json:"totalTokenCount"`
	} `json:"usageMetadata"`
}

func (r geminiGenerateContentResponse) JoinedText() string {
	parts := make([]string, 0)
	for _, candidate := range r.Candidates {
		for _, part := range candidate.Content.Parts {
			if strings.TrimSpace(part.Text) != "" {
				parts = append(parts, strings.TrimSpace(part.Text))
			}
		}
	}
	return strings.Join(parts, "\n\n")
}

func (r geminiGenerateContentResponse) ToolCalls() []ToolCall {
	var calls []ToolCall
	for _, candidate := range r.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.FunctionCall == nil {
				continue
			}
			args := part.FunctionCall.Args
			if args == nil {
				args = map[string]interface{}{}
			}
			id := part.FunctionCall.ID
			if strings.TrimSpace(id) == "" {
				id = fmt.Sprintf("gemini_call_%d", len(calls)+1)
			}
			calls = append(calls, ToolCall{ID: id, Name: part.FunctionCall.Name, Arguments: args})
		}
	}
	return calls
}

func (r geminiGenerateContentResponse) FinishReason() string {
	if len(r.Candidates) == 0 {
		return ""
	}
	return r.Candidates[0].FinishReason
}

// buildGeminiContents 把共用 Message contract 轉成 Gemini native content：
// assistant 要叫 model，assistant 的 ToolCalls 要回放成 functionCall，tool 結果則
// 變成 user role 的 functionResponse。這讓 RunAgentLoop 餵回去的 history 能被
// Gemini 接續理解。
func buildGeminiContents(req AIProviderRequest) []geminiContent {
	if len(req.Messages) == 0 {
		return []geminiContent{{Role: "user", Parts: []geminiPart{{Text: req.UserPrompt}}}}
	}
	contents := make([]geminiContent, 0, len(req.Messages))
	toolCallNames := make(map[string]string)
	for _, m := range req.Messages {
		switch {
		case m.Role == "tool":
			name := toolCallNames[m.ToolCallID]
			if strings.TrimSpace(name) == "" {
				name = m.ToolCallID
			}
			contents = append(contents, geminiContent{
				Role: "user",
				Parts: []geminiPart{{FunctionResponse: &geminiFunctionResponse{
					ID:       m.ToolCallID,
					Name:     name,
					Response: geminiFunctionResponsePayload(m.Content),
				}}},
			})
		case len(m.ToolCalls) > 0:
			parts := make([]geminiPart, 0, len(m.ToolCalls)+1)
			if strings.TrimSpace(m.Content) != "" {
				parts = append(parts, geminiPart{Text: m.Content})
			}
			for _, call := range m.ToolCalls {
				toolCallNames[call.ID] = call.Name
				parts = append(parts, geminiPart{FunctionCall: &geminiFunctionCall{
					ID:   call.ID,
					Name: call.Name,
					Args: call.Arguments,
				}})
			}
			contents = append(contents, geminiContent{Role: geminiRole(m.Role), Parts: parts})
		default:
			contents = append(contents, geminiContent{
				Role:  geminiRole(m.Role),
				Parts: []geminiPart{{Text: m.Content}},
			})
		}
	}
	return contents
}

func buildGeminiTools(tools []ToolDefinition) []geminiTool {
	if len(tools) == 0 {
		return nil
	}
	declarations := make([]geminiFunctionDeclaration, 0, len(tools))
	for _, t := range tools {
		declarations = append(declarations, geminiFunctionDeclaration{
			Name:        t.Name,
			Description: t.Description,
			Parameters:  t.InputSchema,
		})
	}
	return []geminiTool{{FunctionDeclarations: declarations}}
}

func geminiRole(role string) string {
	if role == "assistant" {
		return "model"
	}
	return role
}

func geminiFunctionResponsePayload(content string) map[string]interface{} {
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(content), &payload); err == nil && payload != nil {
		return payload
	}
	if strings.HasPrefix(content, "error:") {
		return map[string]interface{}{"error": strings.TrimSpace(strings.TrimPrefix(content, "error:"))}
	}
	return map[string]interface{}{"result": content}
}

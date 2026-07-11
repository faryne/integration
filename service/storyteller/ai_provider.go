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

// endpoint 只有 self-hosted provider 會用到（自架的 OpenAI 相容 API 位址），
// 其餘固定 provider 一律沿用各自的預設常數，忽略傳入值。
func NewAIProvider(provider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
	switch provider {
	case storytellerModel.AgentProviderGrok:
		return NewGrokProvider(defaultGrokChatCompletionsURL, &http.Client{Timeout: 60 * time.Second}), nil
	case storytellerModel.AgentProviderOpenAI:
		return NewOpenAICompatibleProvider(defaultOpenAIChatCompletionsURL, &http.Client{Timeout: 60 * time.Second}), nil
	case storytellerModel.AgentProviderOpenRouter:
		return NewOpenAICompatibleProvider(defaultOpenRouterChatCompletionsURL, &http.Client{Timeout: 60 * time.Second}), nil
	case storytellerModel.AgentProviderClaude:
		return NewClaudeProvider(defaultClaudeMessagesURL, &http.Client{Timeout: 60 * time.Second}), nil
	case storytellerModel.AgentProviderGemini:
		return NewGeminiProvider(defaultGeminiGenerateContentBaseURL, &http.Client{Timeout: 60 * time.Second}), nil
	case storytellerModel.AgentProviderSelfHosted:
		if strings.TrimSpace(endpoint) == "" {
			return nil, ErrAIProviderMissingEndpoint
		}
		return NewOpenAICompatibleProvider(strings.TrimSpace(endpoint), &http.Client{Timeout: 60 * time.Second}), nil
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
		Model: req.ModelName,
		Messages: []openAIChatMessage{
			{Role: "system", Content: req.SystemPrompt},
			{Role: "user", Content: req.UserPrompt},
		},
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

	var output openAIChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&output); err != nil {
		return nil, fmt.Errorf("%w: decode response failed", ErrAIProviderUnknown)
	}
	if len(output.Choices) == 0 || strings.TrimSpace(output.Choices[0].Message.Content) == "" {
		return nil, ErrAIProviderEmptyResult
	}
	return &AIProviderResponse{
		Result: strings.TrimSpace(output.Choices[0].Message.Content),
		Usage: &AIProviderUsage{
			InputTokens:  output.Usage.PromptTokens,
			OutputTokens: output.Usage.CompletionTokens,
			TotalTokens:  output.Usage.TotalTokens,
		},
		FinishReason: output.Choices[0].FinishReason,
	}, nil
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
	Model    string              `json:"model"`
	Messages []openAIChatMessage `json:"messages"`
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIChatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
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
		MaxTokens: 4096,
		System:    req.SystemPrompt,
		Messages:  []claudeMessage{{Role: "user", Content: req.UserPrompt}},
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
	var output claudeMessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&output); err != nil {
		return nil, fmt.Errorf("%w: decode response failed", ErrAIProviderUnknown)
	}
	result := strings.TrimSpace(output.JoinedText())
	if result == "" {
		return nil, ErrAIProviderEmptyResult
	}
	return &AIProviderResponse{
		Result: result,
		Usage: &AIProviderUsage{
			InputTokens:  output.Usage.InputTokens,
			OutputTokens: output.Usage.OutputTokens,
			TotalTokens:  output.Usage.InputTokens + output.Usage.OutputTokens,
		},
		FinishReason: output.StopReason,
	}, nil
}

type claudeMessageRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeMessageResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	StopReason string `json:"stop_reason"`
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
		Contents: []geminiContent{
			{
				Role:  "user",
				Parts: []geminiPart{{Text: req.UserPrompt}},
			},
		},
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
	var output geminiGenerateContentResponse
	if err := json.NewDecoder(resp.Body).Decode(&output); err != nil {
		return nil, fmt.Errorf("%w: decode response failed", ErrAIProviderUnknown)
	}
	result := strings.TrimSpace(output.JoinedText())
	if result == "" {
		return nil, ErrAIProviderEmptyResult
	}
	return &AIProviderResponse{
		Result: result,
		Usage: &AIProviderUsage{
			InputTokens:  output.UsageMetadata.PromptTokenCount,
			OutputTokens: output.UsageMetadata.CandidatesTokenCount,
			TotalTokens:  output.UsageMetadata.TotalTokenCount,
		},
		FinishReason: output.FinishReason(),
	}, nil
}

type geminiGenerateContentRequest struct {
	SystemInstruction geminiContent   `json:"system_instruction"`
	Contents          []geminiContent `json:"contents"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
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

func (r geminiGenerateContentResponse) FinishReason() string {
	if len(r.Candidates) == 0 {
		return ""
	}
	return r.Candidates[0].FinishReason
}

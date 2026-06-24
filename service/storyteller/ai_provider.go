package storyteller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const defaultGrokChatCompletionsURL = "https://api.x.ai/v1/chat/completions"

var (
	ErrAIProviderInvalidAPIKey = errors.New("ai provider api key is invalid")
	ErrAIProviderRateLimited   = errors.New("ai provider rate limited")
	ErrAIProviderTimeout       = errors.New("ai provider timeout")
	ErrAIProviderUnavailable   = errors.New("ai provider unavailable")
	ErrAIProviderInvalidModel  = errors.New("ai provider model is invalid")
	ErrAIProviderEmptyResult   = errors.New("ai provider returned empty result")
	ErrAIProviderUnknown       = errors.New("ai provider error")
	ErrAIProviderUnsupported   = errors.New("ai provider is not supported")
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

func NewAIProvider(provider storytellerModel.AgentProvider) (AIProvider, error) {
	switch provider {
	case storytellerModel.AgentProviderGrok:
		return NewGrokProvider(defaultGrokChatCompletionsURL, &http.Client{Timeout: 60 * time.Second}), nil
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
	if strings.TrimSpace(req.APIKey) == "" {
		return nil, ErrAIProviderInvalidAPIKey
	}
	if strings.TrimSpace(req.ModelName) == "" {
		return nil, ErrAIProviderInvalidModel
	}
	body, err := json.Marshal(grokChatCompletionRequest{
		Model: req.ModelName,
		Messages: []grokChatMessage{
			{Role: "system", Content: req.SystemPrompt},
			{Role: "user", Content: req.UserPrompt},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("%w: encode request failed", ErrAIProviderUnknown)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request failed", ErrAIProviderUnknown)
	}
	httpReq.Header.Set("Authorization", "Bearer "+strings.TrimSpace(req.APIKey))
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
		return nil, grokStatusError(resp.StatusCode, resp.Body)
	}

	var output grokChatCompletionResponse
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

func grokStatusError(statusCode int, body io.Reader) error {
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

type grokChatCompletionRequest struct {
	Model    string            `json:"model"`
	Messages []grokChatMessage `json:"messages"`
}

type grokChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type grokChatCompletionResponse struct {
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

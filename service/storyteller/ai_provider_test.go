package storyteller

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestNewAIProvider(t *testing.T) {
	provider, err := NewAIProvider(storytellerModel.AgentProviderGrok)
	require.NoError(t, err)
	require.IsType(t, &GrokProvider{}, provider)

	provider, err = NewAIProvider(storytellerModel.AgentProvider("unknown"))
	require.Nil(t, provider)
	require.ErrorIs(t, err, ErrAIProviderUnsupported)
}

func TestGrokProviderGenerate(t *testing.T) {
	var request grokChatCompletionRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		return jsonResponse(http.StatusOK, `{
			"choices": [
				{
					"message": {"content": "generated text"},
					"finish_reason": "stop"
				}
			],
			"usage": {
				"prompt_tokens": 12,
				"completion_tokens": 5,
				"total_tokens": 17
			}
		}`), nil
	})}

	provider := NewGrokProvider("https://example.test/chat", client)
	response, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:       "test-key",
		ModelName:    "grok-test",
		SystemPrompt: "system prompt",
		UserPrompt:   "user prompt",
	})

	require.NoError(t, err)
	require.Equal(t, "grok-test", request.Model)
	require.Len(t, request.Messages, 2)
	require.Equal(t, "system", request.Messages[0].Role)
	require.Equal(t, "system prompt", request.Messages[0].Content)
	require.Equal(t, "user", request.Messages[1].Role)
	require.Equal(t, "user prompt", request.Messages[1].Content)
	require.Equal(t, "generated text", response.Result)
	require.Equal(t, "stop", response.FinishReason)
	require.Equal(t, 12, response.Usage.InputTokens)
	require.Equal(t, 5, response.Usage.OutputTokens)
	require.Equal(t, 17, response.Usage.TotalTokens)
}

func TestGrokProviderGenerateStatusErrors(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		wantErr    error
	}{
		{name: "unauthorized", statusCode: http.StatusUnauthorized, wantErr: ErrAIProviderInvalidAPIKey},
		{name: "rate limited", statusCode: http.StatusTooManyRequests, wantErr: ErrAIProviderRateLimited},
		{name: "bad request", statusCode: http.StatusBadRequest, wantErr: ErrAIProviderInvalidModel},
		{name: "timeout", statusCode: http.StatusGatewayTimeout, wantErr: ErrAIProviderTimeout},
		{name: "unavailable", statusCode: http.StatusServiceUnavailable, wantErr: ErrAIProviderUnavailable},
		{name: "unknown", statusCode: http.StatusInternalServerError, wantErr: ErrAIProviderUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := NewGrokProvider("https://example.test/chat", &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return jsonResponse(tt.statusCode, `{"error":{"message":"provider failed"}}`), nil
			})})
			response, err := provider.Generate(context.Background(), AIProviderRequest{
				APIKey:       "test-key",
				ModelName:    "grok-test",
				SystemPrompt: "system prompt",
				UserPrompt:   "user prompt",
			})

			require.Nil(t, response)
			require.ErrorIs(t, err, tt.wantErr)
		})
	}
}

func TestGrokProviderGenerateEmptyResult(t *testing.T) {
	provider := NewGrokProvider("https://example.test/chat", &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return jsonResponse(http.StatusOK, `{"choices":[{"message":{"content":"   "}}]}`), nil
	})})
	response, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:       "test-key",
		ModelName:    "grok-test",
		SystemPrompt: "system prompt",
		UserPrompt:   "user prompt",
	})

	require.Nil(t, response)
	require.ErrorIs(t, err, ErrAIProviderEmptyResult)
}

func TestGrokProviderGenerateRequestValidation(t *testing.T) {
	provider := NewGrokProvider("http://example.invalid", http.DefaultClient)

	response, err := provider.Generate(context.Background(), AIProviderRequest{ModelName: "grok-test"})
	require.Nil(t, response)
	require.ErrorIs(t, err, ErrAIProviderInvalidAPIKey)

	response, err = provider.Generate(context.Background(), AIProviderRequest{APIKey: "test-key"})
	require.Nil(t, response)
	require.ErrorIs(t, err, ErrAIProviderInvalidModel)
}

func TestBuildAgentRunPrompts(t *testing.T) {
	start := 0
	end := 5
	systemPrompt, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{
		DefaultPrompt: "Use a quiet horror tone.",
	}, storytellerModel.AgentRunRequest{
		Mode:            storytellerModel.AgentRunModeRewriteSelection,
		Instruction:     "Make it sharper.",
		FullContent:     "Full chapter.",
		SelectedContent: "Scene",
		SelectionStart:  &start,
		SelectionEnd:    &end,
	})

	require.Contains(t, systemPrompt, "Use a quiet horror tone.")
	require.Contains(t, userPrompt, "Task mode:\nrewrite_selection")
	require.Contains(t, userPrompt, "User instruction:\nMake it sharper.")
	require.NotContains(t, userPrompt, "Current chapter full content:")
	require.NotContains(t, userPrompt, "Full chapter.")
	require.Contains(t, userPrompt, "Current selected text:")
	require.Contains(t, userPrompt, "Only output the rewritten text.")
}

func TestBuildAgentRunPromptsIncludesFullContentForChapterMode(t *testing.T) {
	_, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{}, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomChapter,
		Instruction: "Analyze the chapter.",
		FullContent: "Full chapter.",
	})

	require.Contains(t, userPrompt, "Current chapter full content:")
	require.Contains(t, userPrompt, "Full chapter.")
	require.NotContains(t, userPrompt, "Current selected text:")
}

func TestGrokStatusErrorWrapsExpectedSentinel(t *testing.T) {
	err := grokStatusError(http.StatusUnauthorized, strings.NewReader(`{"error":"bad key"}`))
	require.ErrorIs(t, err, ErrAIProviderInvalidAPIKey)
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func jsonResponse(statusCode int, body string) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewBufferString(body)),
	}
}

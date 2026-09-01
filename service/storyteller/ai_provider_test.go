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
	provider, err := NewAIProvider(storytellerModel.AgentProviderGrok, "")
	require.NoError(t, err)
	require.IsType(t, &GrokProvider{}, provider)

	provider, err = NewAIProvider(storytellerModel.AgentProviderGemini, "")
	require.NoError(t, err)
	require.IsType(t, &GeminiProvider{}, provider)

	provider, err = NewAIProvider(storytellerModel.AgentProvider("unknown"), "")
	require.Nil(t, provider)
	require.ErrorIs(t, err, ErrAIProviderUnsupported)

	provider, err = NewAIProvider(storytellerModel.AgentProviderSelfHosted, "")
	require.Nil(t, provider)
	require.ErrorIs(t, err, ErrAIProviderMissingEndpoint)

	provider, err = NewAIProvider(storytellerModel.AgentProviderSelfHosted, "https://my-vllm.internal/v1/chat/completions")
	require.NoError(t, err)
	require.IsType(t, &OpenAICompatibleProvider{}, provider)
}

func TestGrokProviderGenerate(t *testing.T) {
	var request openAIChatCompletionRequest
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

func TestGeminiProviderGenerate(t *testing.T) {
	var request geminiGenerateContentRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1beta/models/gemini-2.5-flash:generateContent", r.URL.Path)
		require.Equal(t, "test-key", r.URL.Query().Get("key"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		return jsonResponse(http.StatusOK, `{
			"candidates": [
				{
					"content": {"parts": [{"text": "generated text"}]},
					"finishReason": "STOP"
				}
			],
			"usageMetadata": {
				"promptTokenCount": 12,
				"candidatesTokenCount": 5,
				"totalTokenCount": 17
			}
		}`), nil
	})}

	provider := NewGeminiProvider("https://example.test/v1beta/models", client)
	response, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:       "test-key",
		ModelName:    "gemini-2.5-flash",
		SystemPrompt: "system prompt",
		UserPrompt:   "user prompt",
	})

	require.NoError(t, err)
	require.Len(t, request.SystemInstruction.Parts, 1)
	require.Equal(t, "system prompt", request.SystemInstruction.Parts[0].Text)
	require.Len(t, request.Contents, 1)
	require.Equal(t, "user", request.Contents[0].Role)
	require.Equal(t, "user prompt", request.Contents[0].Parts[0].Text)
	require.Equal(t, "generated text", response.Result)
	require.Equal(t, "STOP", response.FinishReason)
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
	systemPrompt, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{
		DefaultPrompt: "Use a quiet horror tone.",
	}, storytellerModel.AgentRunRequest{
		Mode:            storytellerModel.AgentRunModeRewriteSelection,
		Instruction:     "Make it sharper.",
		FullContent:     "Full chapter.",
		SelectedContent: "Scene",
	}, "project-public-id", agentRunTarget{Kind: agenticQueryCurrentTargetStory, PublicID: "story-public-id", Title: "測試故事"}, false)

	require.Contains(t, systemPrompt, "Use a quiet horror tone.")
	require.Contains(t, systemPrompt, "Authorized project_public_id for this skill run: project-public-id")
	require.Contains(t, userPrompt, "Task mode:\nrewrite_selection")
	require.Contains(t, userPrompt, "User instruction:\nMake it sharper.")
	require.NotContains(t, userPrompt, "User's current unsaved editor content:")
	require.NotContains(t, userPrompt, "Full chapter.")
	require.Contains(t, userPrompt, "User's current selected text from the editor")
	require.Contains(t, userPrompt, "Only output the rewritten text.")
}

func TestBuildAgentRunPromptsFallsBackToFullContentWhenSelectionModeHasNoSelection(t *testing.T) {
	_, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{}, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomSelection,
		Instruction: "Make it sharper.",
		FullContent: "Full chapter.",
	}, "project-public-id", agentRunTarget{Kind: agenticQueryCurrentTargetStory, PublicID: "story-public-id"}, false)

	require.Contains(t, userPrompt, "User's current unsaved editor content:")
	require.Contains(t, userPrompt, "Full chapter.")
	require.NotContains(t, userPrompt, "STORY_SELECTED_CONTENT")
}

func TestBuildAgentRunPromptsIncludesFullContentForChapterMode(t *testing.T) {
	_, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{}, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeContinueChapter,
		Instruction: "Analyze the chapter.",
		FullContent: "Full chapter.",
	}, "project-public-id", agentRunTarget{Kind: agenticQueryCurrentTargetStory, PublicID: "story-public-id"}, false)

	require.Contains(t, userPrompt, "User's current unsaved editor content:")
	require.Contains(t, userPrompt, "Full chapter.")
	require.NotContains(t, userPrompt, "User's current selected text")
}

func TestBuildAgentRunPromptsAllowsEmptyInstruction(t *testing.T) {
	_, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{}, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeContinueChapter,
		FullContent: "Full chapter.",
	}, "project-public-id", agentRunTarget{Kind: agenticQueryCurrentTargetStory, PublicID: "story-public-id"}, false)

	require.Contains(t, userPrompt, "User instruction:\n(No additional instruction was provided.)")
	require.Contains(t, userPrompt, "User's current unsaved editor content:")
}

func TestBuildAgentRunPromptsOmitsEmptyFullContent(t *testing.T) {
	_, userPrompt := buildAgentRunPrompts(storytellerModel.Agent{}, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeContinueChapter,
		Instruction: "Only use this request.",
	}, "project-public-id", agentRunTarget{Kind: agenticQueryCurrentTargetStory, PublicID: "story-public-id"}, false)

	require.Contains(t, userPrompt, "User instruction:\nOnly use this request.")
	require.NotContains(t, userPrompt, "User's current unsaved editor content:")
}

func TestOpenAICompatibleGenerateWithTools(t *testing.T) {
	var request openAIChatCompletionRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		return jsonResponse(http.StatusOK, `{
			"choices": [
				{
					"message": {
						"content": "",
						"tool_calls": [
							{"id": "call_1", "type": "function", "function": {"name": "storyteller_get_story", "arguments": "{\"story_public_id\":\"abc\"}"}}
						]
					},
					"finish_reason": "tool_calls"
				}
			],
			"usage": {"prompt_tokens": 20, "completion_tokens": 8, "total_tokens": 28}
		}`), nil
	})}

	provider := NewOpenAICompatibleProvider("https://example.test/chat", client)
	response, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:       "test-key",
		ModelName:    "gpt-test",
		SystemPrompt: "system prompt",
		UserPrompt:   "user prompt",
		Tools: []ToolDefinition{{
			Name:        "storyteller_get_story",
			Description: "Get a story.",
			InputSchema: map[string]interface{}{"type": "object"},
		}},
	})

	require.NoError(t, err)
	// tools 欄位要正確帶進 request body。
	require.Len(t, request.Tools, 1)
	require.Equal(t, "function", request.Tools[0].Type)
	require.Equal(t, "storyteller_get_story", request.Tools[0].Function.Name)
	// 只有工具呼叫、沒有文字答案不能被當成空結果拒絕。
	require.Empty(t, response.Result)
	require.Len(t, response.ToolCalls, 1)
	require.Equal(t, "call_1", response.ToolCalls[0].ID)
	require.Equal(t, "storyteller_get_story", response.ToolCalls[0].Name)
	// arguments 是 OpenAI 回傳的 JSON 編碼字串，要被解析成 map，不是原始字串。
	require.Equal(t, "abc", response.ToolCalls[0].Arguments["story_public_id"])
}

func TestOpenAICompatibleGenerateWithMessagesHistory(t *testing.T) {
	var request openAIChatCompletionRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		return jsonResponse(http.StatusOK, `{"choices":[{"message":{"content":"final answer"}}]}`), nil
	})}

	provider := NewOpenAICompatibleProvider("https://example.test/chat", client)
	_, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:       "test-key",
		ModelName:    "gpt-test",
		SystemPrompt: "system prompt",
		Messages: []Message{
			{Role: "user", Content: "look up the story"},
			{Role: "assistant", ToolCalls: []ToolCall{{ID: "call_1", Name: "storyteller_get_story", Arguments: map[string]interface{}{"story_public_id": "abc"}}}},
			{Role: "tool", ToolCallID: "call_1", Content: `{"title":"測試故事"}`},
		},
	})

	require.NoError(t, err)
	// Messages 非空時取代 SystemPrompt/UserPrompt 的單輪組法，system 訊息還是排最前面。
	require.Len(t, request.Messages, 4)
	require.Equal(t, "system", request.Messages[0].Role)
	require.Equal(t, "user", request.Messages[1].Role)
	require.Equal(t, "assistant", request.Messages[2].Role)
	require.Len(t, request.Messages[2].ToolCalls, 1)
	require.Equal(t, "call_1", request.Messages[2].ToolCalls[0].ID)
	require.Equal(t, "tool", request.Messages[3].Role)
	require.Equal(t, "call_1", request.Messages[3].ToolCallID)
}

func TestClaudeProviderGenerateWithTools(t *testing.T) {
	var request claudeMessageRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		return jsonResponse(http.StatusOK, `{
			"content": [
				{"type": "text", "text": "let me check"},
				{"type": "tool_use", "id": "toolu_1", "name": "storyteller_get_story", "input": {"story_public_id": "abc"}}
			],
			"stop_reason": "tool_use",
			"usage": {"input_tokens": 10, "output_tokens": 6}
		}`), nil
	})}

	provider := NewClaudeProvider("https://example.test/messages", client)
	response, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:       "test-key",
		ModelName:    "claude-test",
		SystemPrompt: "system prompt",
		UserPrompt:   "user prompt",
		Tools: []ToolDefinition{{
			Name:        "storyteller_get_story",
			Description: "Get a story.",
			InputSchema: map[string]interface{}{"type": "object"},
		}},
	})

	require.NoError(t, err)
	require.Len(t, request.Tools, 1)
	require.Equal(t, "storyteller_get_story", request.Tools[0].Name)
	require.Equal(t, "let me check", response.Result)
	require.Len(t, response.ToolCalls, 1)
	require.Equal(t, "toolu_1", response.ToolCalls[0].ID)
	require.Equal(t, "abc", response.ToolCalls[0].Arguments["story_public_id"])
}

func TestClaudeProviderGenerateWithToolResultMessage(t *testing.T) {
	var request claudeMessageRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		return jsonResponse(http.StatusOK, `{"content":[{"type":"text","text":"final answer"}],"stop_reason":"end_turn"}`), nil
	})}

	provider := NewClaudeProvider("https://example.test/messages", client)
	_, err := provider.Generate(context.Background(), AIProviderRequest{
		APIKey:    "test-key",
		ModelName: "claude-test",
		Messages: []Message{
			{Role: "user", Content: "look up the story"},
			{Role: "assistant", ToolCalls: []ToolCall{{ID: "toolu_1", Name: "storyteller_get_story", Arguments: map[string]interface{}{"story_public_id": "abc"}}}},
			{Role: "tool", ToolCallID: "toolu_1", Content: `{"title":"測試故事"}`},
		},
	})

	require.NoError(t, err)
	require.Len(t, request.Messages, 3)
	// tool 角色在 Claude 沒有對應 role，要被轉成 user 訊息底下的 tool_result block。
	require.Equal(t, "user", request.Messages[2].Role)
	require.Equal(t, "tool_result", request.Messages[2].Content[0].Type)
	require.Equal(t, "toolu_1", request.Messages[2].Content[0].ToolUseID)
	// assistant 的 tool_use 要轉成對應的 content block。
	require.Equal(t, "assistant", request.Messages[1].Role)
	require.Equal(t, "tool_use", request.Messages[1].Content[0].Type)
	require.Equal(t, "storyteller_get_story", request.Messages[1].Content[0].Name)
}

func TestGeminiProviderRunAgentLoopToolCallingRoundTrip(t *testing.T) {
	var requests []geminiGenerateContentRequest
	var requestPaths []string
	var requestKeys []string
	var decodeErr error
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var request geminiGenerateContentRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			decodeErr = err
			return jsonResponse(http.StatusBadRequest, err.Error()), nil
		}
		requests = append(requests, request)
		requestPaths = append(requestPaths, r.URL.Path)
		requestKeys = append(requestKeys, r.URL.Query().Get("key"))
		if len(requests) == 1 {
			return jsonResponse(http.StatusOK, `{
				"candidates": [{
					"content": {"role": "model", "parts": [{"functionCall": {"id": "gemini_call_1", "name": "get_story_title", "args": {"story_public_id": "abc"}}}]},
					"finishReason": "STOP"
				}],
				"usageMetadata": {"promptTokenCount": 11, "candidatesTokenCount": 4, "totalTokenCount": 15}
			}`), nil
		}
		return jsonResponse(http.StatusOK, `{
			"candidates": [{
				"content": {"role": "model", "parts": [{"text": "這篇故事叫《測試故事》。"}]},
				"finishReason": "STOP"
			}],
			"usageMetadata": {"promptTokenCount": 21, "candidatesTokenCount": 8, "totalTokenCount": 29}
		}`), nil
	})}

	toolCalled := false
	provider := NewGeminiProvider("https://example.test/v1beta/models", client)
	result, err := RunAgentLoop(context.Background(), AgentLoopRequest{
		Provider:     provider,
		APIKey:       "test-key",
		ModelName:    "gemini-2.5-flash",
		SystemPrompt: "你是故事編輯助理。",
		UserPrompt:   "這篇故事叫什麼名字？",
		MaxSteps:     2,
		Tools: []ToolSpec{{
			Name:        "get_story_title",
			Description: "Get a story's title.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{"story_public_id": map[string]interface{}{"type": "string"}},
				"required":   []string{"story_public_id"},
			},
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				toolCalled = true
				require.Equal(t, "abc", arguments["story_public_id"])
				return map[string]string{"title": "測試故事"}, nil
			},
		}},
	})

	require.NoError(t, decodeErr)
	require.NoError(t, err)
	require.True(t, toolCalled, "Gemini 回 functionCall 後，agent loop 應該真的執行工具")
	require.Equal(t, "這篇故事叫《測試故事》。", result.FinalText)
	require.Len(t, result.Steps, 1)
	require.Len(t, result.Steps[0].ToolCalls, 1)
	require.Equal(t, "gemini_call_1", result.Steps[0].ToolCalls[0].ID)
	require.Equal(t, "get_story_title", result.Steps[0].ToolCalls[0].Name)
	require.Len(t, requests, 2)
	require.Equal(t, []string{"/v1beta/models/gemini-2.5-flash:generateContent", "/v1beta/models/gemini-2.5-flash:generateContent"}, requestPaths)
	require.Equal(t, []string{"test-key", "test-key"}, requestKeys)

	first := requests[0]
	require.Len(t, first.Tools, 1)
	require.Len(t, first.Tools[0].FunctionDeclarations, 1)
	require.Equal(t, "get_story_title", first.Tools[0].FunctionDeclarations[0].Name)
	require.Equal(t, "object", first.Tools[0].FunctionDeclarations[0].Parameters["type"])
	require.Len(t, first.Contents, 1)
	require.Equal(t, "user", first.Contents[0].Role)
	require.Equal(t, "這篇故事叫什麼名字？", first.Contents[0].Parts[0].Text)

	second := requests[1]
	require.Len(t, second.Contents, 3)
	require.Equal(t, "user", second.Contents[0].Role)
	require.Equal(t, "model", second.Contents[1].Role)
	require.NotNil(t, second.Contents[1].Parts[0].FunctionCall)
	require.Equal(t, "gemini_call_1", second.Contents[1].Parts[0].FunctionCall.ID)
	require.Equal(t, "get_story_title", second.Contents[1].Parts[0].FunctionCall.Name)
	require.Equal(t, "abc", second.Contents[1].Parts[0].FunctionCall.Args["story_public_id"])
	require.Equal(t, "user", second.Contents[2].Role)
	require.NotNil(t, second.Contents[2].Parts[0].FunctionResponse)
	require.Equal(t, "gemini_call_1", second.Contents[2].Parts[0].FunctionResponse.ID)
	require.Equal(t, "get_story_title", second.Contents[2].Parts[0].FunctionResponse.Name)
	require.Equal(t, "測試故事", second.Contents[2].Parts[0].FunctionResponse.Response["title"])
}

func TestGeminiProviderRunAgentLoopPreservesThoughtSignature(t *testing.T) {
	const signature = "EpoGCpcGAXLI2nx/example=="
	var requests []geminiGenerateContentRequest
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var request geminiGenerateContentRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&request))
		requests = append(requests, request)
		if len(requests) == 1 {
			return jsonResponse(http.StatusOK, `{
				"candidates": [{
					"content": {"role": "model", "parts": [{"thoughtSignature": "`+signature+`", "functionCall": {"id": "gemini_call_1", "name": "get_story_title", "args": {"story_public_id": "abc"}}}]},
					"finishReason": "STOP"
				}]
			}`), nil
		}
		return jsonResponse(http.StatusOK, `{
			"candidates": [{
				"content": {"role": "model", "parts": [{"text": "這篇故事叫《測試故事》。"}]},
				"finishReason": "STOP"
			}]
		}`), nil
	})}

	result, err := RunAgentLoop(context.Background(), AgentLoopRequest{
		Provider:   NewGeminiProvider("https://example.test/v1beta/models", client),
		APIKey:     "test-key",
		ModelName:  "gemini-3-flash-preview",
		UserPrompt: "這篇故事叫什麼名字？",
		MaxSteps:   2,
		Tools: []ToolSpec{{
			Name:        "get_story_title",
			InputSchema: map[string]interface{}{"type": "object"},
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return map[string]string{"title": "測試故事"}, nil
			},
		}},
	})

	require.NoError(t, err)
	require.Equal(t, "這篇故事叫《測試故事》。", result.FinalText)
	require.Len(t, result.Steps, 1)
	require.Equal(t, signature, result.Steps[0].ToolCalls[0].ThoughtSignature)
	require.Len(t, requests, 2)
	require.Equal(t, "model", requests[1].Contents[1].Role)
	require.NotNil(t, requests[1].Contents[1].Parts[0].FunctionCall)
	require.Equal(t, signature, requests[1].Contents[1].Parts[0].ThoughtSignature)
}

func TestGrokStatusErrorWrapsExpectedSentinel(t *testing.T) {
	err := aiProviderStatusError(http.StatusUnauthorized, strings.NewReader(`{"error":"bad key"}`))
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

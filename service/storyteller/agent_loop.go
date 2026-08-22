package storyteller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
)

// 這是 Phase 3 的雛型：只驗證「provider tool-calling 擴充（Phase 2）＋ tool
// registry（Phase 1）」兩塊兜不兜得起來，故意不做 project 範圍限縮、usage 記錄、
// 可設定的步數上限——這些是 Phase 4 才要補的正式安全機制。呼叫端目前要自己決定
// Tools 要傳哪些 ToolSpec（例如只給唯讀工具），還沒有內建的授權範圍檢查。

// ErrAgentLoopMaxStepsExceeded 代表這輪對話一直要求呼叫工具、遲遲不給最終答案，
// 超過安全上限被強制中止。這是所有 agentic 系統的標準風險控制，沒有明確上限的話
// 一次失控呼叫可能把使用者的 API 額度燒光。
var ErrAgentLoopMaxStepsExceeded = errors.New("agent loop exceeded max steps")

// defaultAgentLoopMaxSteps 是 AgentLoopRequest.MaxSteps 留空（0）時的預設上限。
const defaultAgentLoopMaxSteps = 8

// AgentLoopRequest 是跑一次 agent loop 需要的輸入。
type AgentLoopRequest struct {
	Provider     AIProvider
	APIKey       string
	ModelName    string
	SystemPrompt string
	UserPrompt   string
	// Tools 是這次對話允許呼叫的工具，呼叫端自己決定要開放哪些（例如 project
	// 範圍限縮／唯讀限制都是呼叫端在組這份清單時就要處理好，見 ScopeToolsToProject
	// 跟 ReadOnlyStorytellerTools）。
	Tools []ToolSpec
	// MaxSteps 是這輪對話最多允許幾次「provider 要求呼叫工具」的來回，超過會被
	// 強制中止並回傳 ErrAgentLoopMaxStepsExceeded。留空（0 或負數）使用
	// defaultAgentLoopMaxSteps。
	MaxSteps int
}

// AgentLoopResult 是跑完一輪 loop 的結果。
type AgentLoopResult struct {
	FinalText string
	// Steps 記錄每一輪呼叫了哪些工具、各自的結果，方便除錯，也對應之後 Phase 6
	// 「正在呼叫哪個工具」的過程提示會需要的資料。
	Steps []AgentLoopStep
	// Usage 是這輪對話全部 provider.Generate() 呼叫（工具呼叫的中間輪次加上給出
	// 最終答案的那一輪）加總的 token 用量，nil 代表 provider 完全沒回傳用量資訊。
	Usage *AIProviderUsage
}

// AgentLoopStep 是 loop 裡的一輪：provider 要求呼叫哪些工具，以及各自的執行結果
// （ToolCalls／Results 用同一個索引對應）。
type AgentLoopStep struct {
	ToolCalls []ToolCall
	Results   []AgentLoopToolResult
}

// AgentLoopToolResult 是單一次工具呼叫的結果。Err 非 nil 時 Content 是給模型看的
// 錯誤說明（"error: ..."），不是直接把 Go error 吞掉——讓模型知道這次呼叫失敗、
// 可以自己決定要不要換個方式重試或改變計畫，而不是讓整個 loop 因為單一工具失敗
// 就整輪中止。
type AgentLoopToolResult struct {
	Content string
	Err     error
}

// RunAgentLoop 呼叫 provider → 收到 ToolCalls 就執行 → 把結果餵回去 → 重複，直到
// provider 不再要求呼叫工具（回傳最終文字答案）或超過 agentLoopMaxSteps。
func RunAgentLoop(ctx context.Context, req AgentLoopRequest) (*AgentLoopResult, error) {
	toolByName := make(map[string]ToolSpec, len(req.Tools))
	toolDefs := make([]ToolDefinition, 0, len(req.Tools))
	for _, spec := range req.Tools {
		toolByName[spec.Name] = spec
		toolDefs = append(toolDefs, ToolDefinition{
			Name:        spec.Name,
			Description: spec.Description,
			InputSchema: spec.InputSchema,
		})
	}

	maxSteps := req.MaxSteps
	if maxSteps <= 0 {
		maxSteps = defaultAgentLoopMaxSteps
	}

	messages := []Message{{Role: "user", Content: req.UserPrompt}}
	result := &AgentLoopResult{}

	for step := 0; step < maxSteps; step++ {
		resp, err := req.Provider.Generate(ctx, AIProviderRequest{
			APIKey:       req.APIKey,
			ModelName:    req.ModelName,
			SystemPrompt: req.SystemPrompt,
			Messages:     messages,
			Tools:        toolDefs,
		})
		if err != nil {
			return nil, err
		}
		result.Usage = sumAgentLoopUsage(result.Usage, resp.Usage)
		if len(resp.ToolCalls) == 0 {
			result.FinalText = resp.Result
			return result, nil
		}

		messages = append(messages, Message{
			Role:      "assistant",
			Content:   resp.Result,
			ToolCalls: resp.ToolCalls,
		})

		loopStep := AgentLoopStep{ToolCalls: resp.ToolCalls}
		for _, call := range resp.ToolCalls {
			resultText, callErr := executeAgentLoopTool(ctx, toolByName, call)
			loopStep.Results = append(loopStep.Results, AgentLoopToolResult{Content: resultText, Err: callErr})
			messages = append(messages, Message{
				Role:       "tool",
				ToolCallID: call.ID,
				Content:    resultText,
			})
		}
		result.Steps = append(result.Steps, loopStep)
	}
	// 回傳累積到目前為止的 result（Usage／Steps），不要整批丟掉——步數上限被觸發
	// 通常代表 provider 已經燒了好幾輪 token，呼叫端需要知道燒了多少才能記進
	// usage log，不能因為最後沒拿到最終答案就假裝這些呼叫沒發生過。
	return result, ErrAgentLoopMaxStepsExceeded
}

// sumAgentLoopUsage 累加多輪 provider 呼叫的 token 用量，任一輪沒有回傳用量資訊
// （nil）就跳過那一輪，不會讓整個加總變成 0 或 panic。
func sumAgentLoopUsage(total, step *AIProviderUsage) *AIProviderUsage {
	if step == nil {
		return total
	}
	if total == nil {
		total = &AIProviderUsage{}
	}
	return &AIProviderUsage{
		InputTokens:  total.InputTokens + step.InputTokens,
		OutputTokens: total.OutputTokens + step.OutputTokens,
		TotalTokens:  total.TotalTokens + step.TotalTokens,
	}
}

func executeAgentLoopTool(ctx context.Context, toolByName map[string]ToolSpec, call ToolCall) (resultText string, callErr error) {
	spec, ok := toolByName[call.Name]
	if !ok {
		callErr = fmt.Errorf("unknown tool %q", call.Name)
	} else {
		var out interface{}
		out, callErr = spec.Handler(ctx, call.Arguments)
		if callErr == nil {
			resultText = agentLoopToolResultText(out)
		}
	}
	if callErr != nil {
		resultText = "error: " + callErr.Error()
	}
	return resultText, callErr
}

// agentLoopToolResultText 把工具的 interface{} 回傳值轉成餵回 provider 的文字：
// 字串原樣回傳，其餘型別編碼成 JSON 文字——跟 service/mcp 的 ToolSpec→CallToolResult
// 轉譯規則（textResult／jsonTextResult）是同一套判斷邏輯，只是這裡的目的地是
// provider 的 tool_result，不是 MCP 的 CallToolResult。
func agentLoopToolResultText(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	body, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(body)
}

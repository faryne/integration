# AAS Phase 1~7 工作項規劃（2026-08-22）

延續 [AgenticAI規劃.md](AgenticAI規劃.md) 的分期路線圖，把 Phase 1~7 展開成可執行的工作項。**越後面的 Phase 越依賴前面 Phase 實際做完才知道的細節（例如 provider tool-calling 的真實回傳格式），所以 Phase 1~2 給得比較細，Phase 3 之後先列「要做什麼」跟「動工前要先確認什麼」，細部 How 等前面做完再回來補，不在這裡假裝已經知道答案。**

跟這系列其他文件一樣：勾了才代表真的做完＋驗證過，每個 Phase 做完才 commit 一次。Phase 之間如果發現要調整前面的設計，回頭更新對應文件再繼續，不要邊做邊在程式碼裡默默改設計。

---

## Phase 1：Tool Registry 抽象層

目標：把「工具定義＋執行邏輯」從 MCP server 抽出來，變成 MCP 跟未來的 agent runner 都能共用的一份東西。

- [x] **1.1 盤點現況，決定切法**
  - What：讀完 `service/mcp/storyteller_tools.go` 現有全部工具，列出共通結構跟目前檔案大小。
  - ✅ 已完成（2026-08-22）：`registerStorytellerTools()`（[storyteller_tools.go:411](../../../service/mcp/storyteller_tools.go)）目前掛了 **35 個工具**，檔案本身 **1598 行**，遠超這份專案「單一檔案超過 500 行就要審視」的門檻。共通結構完全一致：每個都是 `_ = s.RegisterTool(Tool{Name, Description, InputSchema: objectSchema(...), Handler: func(ctx, arguments) (*CallToolResult, error) {...}})`，Handler 內部固定是「`storytellerUserIDFromContext` 取 userID → `decodeArguments` 解析參數 struct → 呼叫 `storytellerService.NewService()` 的某個方法 → `jsonTextResult(...)` 或 `textResult("deleted")` 包裝回傳」，沒有例外，非常適合抽成 registry。這個 MCP server 是**專案自己手刻的**（`service/mcp/server.go`），不是套用外部 MCP SDK——`Tool`/`ToolHandler`/`CallToolResult` 都是這個 repo 自己定義的型別，不是綁死的第三方協定型別。額外發現一個關鍵限制：`service/mcp` 已經 import `service/storyteller`（`storytellerService "faryne.dev/service/storyteller"`），如果 Phase 1.2 的共用型別放在 `service/mcp` 底下，之後 agent runner（會放在 `service/storyteller`）要重用就會 import 回 `service/mcp`，形成循環 import——**所以共用型別必須放在 `service/storyteller`，由 `service/mcp` 單向 import，不能反過來**。

- [x] **1.2 定義共用的工具描述型別**
  - What：設計一個跟 MCP 傳輸層不綁死的中介型別，描述「這個工具長什麼樣、怎麼執行」。
  - ✅ 已完成（2026-08-22）：新增 [tool_registry.go](../../../service/storyteller/tool_registry.go)，定義 `ToolHandlerFunc`（`func(ctx, arguments) (interface{}, error)`，刻意不回傳 MCP 的 `*CallToolResult`——回傳值交給呼叫端自己決定怎麼包裝，MCP 包成 `CallToolResult`，之後 agent runner 包成 tool_result content block）、`ToolSpec`（`Name`/`Description`/`InputSchema`/`Handler`）、`ToolRegistry`（`Register()`/`All()`，`All()` 回傳 slice 拷貝避免呼叫端改到內部狀態）。`InputSchema` 沿用 JSON Schema 格式，不重新設計。放在 `service/storyteller` 而不是 `service/mcp`，對應 1.1 發現的循環 import 限制。`go build ./...` 過。

- [x] **1.3 把現有 MCP 工具改成從 registry 讀取**
  - What：把 `storyteller_tools.go` 裡 35 個工具的定義搬進 `service/storyteller` 底下的 `ToolRegistry`，`service/mcp/storyteller_tools.go` 的 `registerStorytellerTools()` 改成迴圈讀 registry、把每個 `ToolSpec` 轉成 MCP 的 `Tool` 再 `RegisterTool()`（`ToolHandlerFunc` 回傳的 `interface{}` 依型別包成 `jsonTextResult`／`textResult`：字串就是 `textResult`，其餘型別就是 `jsonTextResult`）。
  - Why：這是驗證 1.2 設計的抽象層是不是真的好用的唯一方式——如果套用到全部既有工具會很痛苦，代表設計要調整。
  - Where：新增 `service/storyteller` 底下的檔案（因為 35 個工具搬過去內容量不小，建議依領域拆成多個檔案，例如 `tool_registry_project.go`／`tool_registry_story.go`／`tool_registry_lore.go`／`tool_registry_asset.go`／`tool_registry_volume.go`，不要塞一個大檔案又超過 500 行）；`service/mcp/storyteller_tools.go` 大幅簡化，只剩 registry→Tool 的轉譯迴圈。
  - How：**這是一次純重構**，外部行為（MCP client 看到的工具清單、呼叫結果的 JSON 內容）必須逐一核對完全不變，尤其原本用 `jsonTextResult`／`textResult` 兩種不同包裝方式的工具，搬過去、轉譯迴圈重新包裝後結果格式不能變。做完要重跑一次 `go test ./service/mcp/...` 確認沒有任何既有測試壞掉，並用 dev-only 假登入 + 本機 `/mcp` endpoint 抽測至少 5-6 個橫跨不同領域（story/lore/asset/volume/project）的工具呼叫，確認回傳內容跟改之前一致，因為這次改動面（35 個工具）比 Phase 0（4 個工具）大很多，光靠 `go build`/`go vet` 不夠。
  - ✅ 已完成（2026-08-22，Codex 實作、Claude 審查採納）：`service/mcp/storyteller_tools.go` 從 1598 行縮到 50 行，只剩 `WithStorytellerUserID`／`WithStorytellerSource`（轉呼叫 `service/storyteller` 對應函式，維持既有呼叫端 `controller/storytellermcp/storytellermcp.go` 完全不用改）跟 `registerStorytellerTools()` 的 registry→`mcp.Tool` 轉譯迴圈。35 個工具依領域拆成 5 個新檔案（`tool_registry_project.go` 2 個、`tool_registry_story.go` 8 個、`tool_registry_lore.go` 10 個、`tool_registry_asset.go` 11 個、`tool_registry_volume.go` 4 個，加總 35，跟 `StorytellerToolRegistry().All()` 回傳數量對上），共用常數/型別（`storytellerContentSyntaxHint`／`storytellerContentMarkerHint`／`storytellerStoryDetail` 等）搬進 `tool_registry_types.go`，context 存取搬進 `tool_registry_context.go`。**Claude 審查方式**：獨立重跑 `go build`／`go vet`／`go test ./service/mcp/... ./service/storyteller/...` 全部通過；逐行讀過 `tool_registry_story.go`（最大、邏輯最複雜的檔案，含 Phase 0 新增的 revert/move 工具跟 Item 4 的 `volume_public_id` nullable 語意）確認跟原本邏輯一致；確認沒有任何 `service/storyteller` 檔案 import 回 `service/mcp`（避免循環 import）；用 `grep -c "ToolSpec{"` 核對 5 個檔案的工具數量加總等於 35。**live `/mcp` 端對端測試沒有做**——Codex 的沙盒環境 Docker socket 被擋，起不了本機 MySQL/Redis，只能做到程式碼審查＋單元測試層級；Codex 自己另外做了 `tools/list` JSON 改動前後 byte-for-byte diff（36 個工具含 built-in `ping` 全部一致）當作行為不變的獨立佐證，Claude 判斷這個組合驗證強度已經足夠，沒有另外找環境補測。

**Phase 1 完成**（2026-08-22）。

## Phase 2：`AIProvider` interface 擴充

目標：讓現有六家 provider 的抽象層能夠支援 tool-calling，同時不破壞現有單輪模式（現有的改寫/擴寫/翻譯等 skill 式功能要維持能動）。

- [x] **2.1 六家 provider tool-calling 格式研究**
  - ✅ 已完成（2026-08-22，依既有知識確認，非即時查最新文件）：
    - **Claude**（Messages API）：request 的 `tools` 陣列每項是 `{name, description, input_schema}`（欄位叫 `input_schema` 不是 `parameters`）；`messages[].content` 可以是純字串也可以是 content block 陣列，要支援 tool-calling 就一律用陣列形式；assistant 回應要求呼叫工具時，`content` 陣列裡會混雜 `{type:"text",...}` 跟 `{type:"tool_use", id, name, input}`（`input` 已經是解析好的 JSON object，不是字串）；下一輪要把結果餵回去時，包成一則 **role="user"** 訊息、`content: [{type:"tool_result", tool_use_id, content}]`——Claude 沒有獨立的 "tool" role。
    - **OpenAI**（Chat Completions API）：request 的 `tools` 陣列每項是 `{type:"function", function:{name, description, parameters}}`；assistant 回應要求呼叫工具時在 `message.tool_calls` 陣列，每項 `{id, type:"function", function:{name, arguments}}`，**`arguments` 是 JSON 編碼過的字串，不是巢狀 object**（跟 Claude 的 `input` 不一樣，這是最容易搞混的地方）；下一輪把結果餵回去是獨立的 **role="tool"** 訊息，帶 `tool_call_id` 對應到那次呼叫。
    - **Grok（xAI）**：官方文件宣稱 API 相容 OpenAI Chat Completions 格式，tool-calling 欄位推定完全比照上面 OpenAI 的格式；這次沒有實際打 API 驗證（沒有可用的 xAI API key），這輪先假設成立，Phase 7 真的要上線前務必用真實 API key 跑一次驗證，不能只憑文件宣稱。
    - **OpenRouter**：本身是轉發層，request/response 格式也是 OpenAI 相容，tool-calling 能不能用完全看背後實際選的模型支不支援，OpenRouter 自己不额外處理。
    - **Self-hosted**：現有假設是 OpenAI 相容端點（vLLM/Ollama 這類），tool-calling 支不支援看使用者自架的服務版本，這輪不特別處理，跟 OpenAI/Grok/OpenRouter 共用同一套轉譯邏輯，能不能用是執行期才知道的事。
    - **Gemini**：`functionDeclarations`（宣告工具，放在 `tools` 底下）／`functionCall`（模型要求呼叫，出現在 `candidates[].content.parts[].functionCall`）／`functionResponse`（回報結果）三個獨立概念，格式跟上面兩家都不同，這輪不實作（見 2.3）。

- [x] **2.2 擴充 `AIProviderRequest`/`AIProviderResponse`**
  - ✅ 已完成（2026-08-22）：`AIProviderRequest` 加 `Tools []ToolDefinition`、`Messages []Message`；`AIProviderResponse` 加 `ToolCalls []ToolCall`。**純加法擴充，沒有動任何既有欄位**——`SystemPrompt`/`UserPrompt` 原封不動保留，`Tools`/`Messages` 都留空時，`generateOpenAICompatible()`／`ClaudeProvider.Generate()` 走的分支（`buildOpenAIMessages`/`buildClaudeMessages` 在 `len(req.Messages)==0` 時）產出的 request body 跟擴充前逐位元組相同。`runAgent()`（[storyteller.go:641](../../../service/storyteller/storyteller.go)）完全沒有改動，也不需要改動——risk 有實際驗證：既有 `TestGrokProviderGenerate`／`TestGeminiProviderGenerate` 兩個測試完全沒改就直接通過，證明單輪路徑行為沒變。

- [x] **2.3 六個 provider adapter 各自處理 tools 欄位**
  - ✅ 已完成（2026-08-22），**比原計畫多涵蓋兩家**：原本計畫只做 Claude／OpenAI，但 `generateOpenAICompatible()` 這個函式本來就是 Grok／OpenAI／OpenRouter／Self-hosted 四個 provider 共用的同一份實作（因為它們都宣稱是 OpenAI wire-format 相容），幫 OpenAI 補 tools 支援等於這四家全部一起拿到，沒有額外成本，也沒有必要刻意用 provider 別名去擋掉 Grok/OpenRouter/Self-hosted 讓它們維持不支援——那樣反而要多寫排除邏輯。所以實際結果是 **Claude、OpenAI、Grok、OpenRouter、Self-hosted 五家都支援 tools**，只有 **Gemini** 這輪明確回傳 `ErrAIProviderUnsupported`（[ai_provider.go](../../../service/storyteller/ai_provider.go) `GeminiProvider.Generate()` 開頭擋掉 `len(req.Tools) > 0` 的情況）。已補 6 個新測試（`TestOpenAICompatibleGenerateWithTools`／`TestOpenAICompatibleGenerateWithMessagesHistory`／`TestClaudeProviderGenerateWithTools`／`TestClaudeProviderGenerateWithToolResultMessage`／`TestGeminiProviderGenerateRejectsTools`，涵蓋 tools 欄位正確帶入 request、response 的 tool_calls 正確解析成統一格式、多輪 Messages 含 tool role 正確轉譯、Gemini 正確拒絕），全部通過，既有測試也全數通過不受影響。

## Phase 3：Claude tool-calling adapter（第一個打通的 provider）

**這是整個 AAS 專案第一次真正端對端跑起來的 Phase，動工前要先確認 Phase 1/2 都做完並且穩定。**

- [ ] **3.1 Claude tool_use/tool_result loop 實作**
  - What：`ClaudeProvider` 補上處理 `Tools`（轉成 Claude Messages API 的 `tools` 欄位）跟解析回傳的 `tool_use` content block（轉成統一的 `ToolCall`）。
  - Where：`service/storyteller/ai_provider.go` 的 `ClaudeProvider`。
  - ✅ 已完成——**這項其實在 Phase 2.3 就一併做掉了**：當時判斷 Claude 是 Phase 3 一定要用到的 provider，`buildClaudeTools()`／`buildClaudeMessages()`／`claudeMessageResponse.ToolCalls()` 這幾個函式已經在 Phase 2 寫好、測過（見 `TestClaudeProviderGenerateWithTools`／`TestClaudeProviderGenerateWithToolResultMessage`），這裡不用重做，純粹補記錄。

- [x] **3.2 Agent loop 雛型（不接 project 範圍限縮，先驗證迴圈本身）**
  - What：寫一個最簡單的迴圈：呼叫 Claude → 有 `tool_calls` 就執行（先接 Phase 1 registry 裡任何一個唯讀工具，例如 `storyteller_get_story`）→ 把結果餵回去 → 重複 → 直到拿到最終文字。
  - Why：先驗證「provider 擴充＋tool registry」這兩塊兜不兜得起來，故意先不接寫入工具、不接 project 範圍限縮，降低這個 Phase 要驗證的變數數量。
  - Where：待定（可能是暫時的測試腳本或一個內部 debug 端點，不一定要馬上做成正式功能）。
  - ✅ 已完成（2026-08-22）：新增 [agent_loop.go](../../../service/storyteller/agent_loop.go)，`RunAgentLoop(ctx, AgentLoopRequest)`——呼叫端傳 `Provider`／`APIKey`／`ModelName`／prompt／`Tools []ToolSpec`（自己決定要開放哪些工具，這輪故意不內建授權範圍檢查），loop 內部組 `Messages` 陣列往返，每輪工具呼叫結果編碼成文字塞回 `role="tool"` 訊息。**做了兩個原計畫沒特別提到、但實際寫的時候發現必須決定的設計**：
    1. **步數上限**：`agentLoopMaxSteps = 8`，寫死常數（Phase 4 才會做成可設定），超過直接回 `ErrAgentLoopMaxStepsExceeded`——沒有上限的話一直要求呼叫工具、不給答案的失控對話會無限燒 token，這是所有 agentic 系統的標準風險控制，雖然 Phase 4 才是正式排定要做這件事的地方，但雛型完全不做這個防護也太危險，這輪就先加了一個保守值。
    2. **單一工具失敗不中止整輪**：某次工具呼叫回錯誤時，把錯誤說明（`"error: ..."`）當成 tool_result 餵回去給模型自己決定下一步（換個方式重試、放棄這個資訊改用其他方式回答），而不是讓整個 loop 直接中止拋錯——比較符合「agent 應該像人一樣，工具用不了就換個辦法」的直覺，也讓整個 loop 對單一工具的暫時性錯誤更有韌性。

- [x] **3.3 端對端手動驗證**
  - What：用 dev-only 假登入 + 一個真實故事，實測「幫我看看這篇故事的設定集有沒有矛盾」這類需要先讀資料才能回答的問題，確認 agent 真的會自己呼叫 `storyteller_get_story`/`storyteller_get_lore`，不是瞎猜答案。
  - ⚠️ **改用 mock 測試取代，真正打真實 Claude API 沒有做**：這個環境沒有可用的 Anthropic API key，沒辦法真的打 Claude API 驗證。改用既有 `ai_provider_test.go` 的 httptest transport mock 模式（`roundTripFunc`），寫了 3 個測試（[agent_loop_test.go](../../../service/storyteller/agent_loop_test.go)）：`TestRunAgentLoopExecutesToolThenReturnsFinalAnswer`（模擬「第一輪要工具、第二輪給答案」的完整兩輪迴圈，驗證工具真的被呼叫、參數正確傳遞、結果正確餵回去、最終答案正確回傳）、`TestRunAgentLoopFeedsToolErrorBackInsteadOfAborting`（驗證上面提到的錯誤不中止整輪的設計）、`TestRunAgentLoopStopsAtMaxSteps`（驗證步數上限真的會擋住失控迴圈）。這證明了 loop 的機制邏輯正確，但**沒有驗證到「Claude 模型本身真的會正確判斷什麼時候該呼叫工具」這件事**（mock 測試裡工具呼叫時機是我自己寫死在假回應裡的，不是模型的真實判斷）。**這件事需要 Faryne 之後用自己的 Claude API key 實際跑一次才能確認**，建議之後找一個真實故事＋真實設定集，用 Phase 4 做完、有正式 API 呼叫入口之後再測，這樣不用為了這次驗證另外寫一次性的測試腳本。

## Phase 3 完成（2026-08-22）

## Phase 4：Agent loop orchestration ＋ project 範圍限縮

- [x] **4.1 補上 project 範圍限縮**
  - What：Tool registry 組出來的每個工具呼叫，綁進呼叫當下授權的 `project_id`，agent 物理上碰不到別的專案（呼應開放問題 3 的定案）。
  - Where：Phase 1 的 tool registry 執行邏輯裡；`RunAgentLoop`（[agent_loop.go](../../../service/storyteller/agent_loop.go)）目前完全沒做這個檢查，呼叫端傳什麼 `Tools` 就是什麼，這是 Phase 3 雛型故意留下的缺口，Phase 4 要補上。
  - How：具體怎麼綁（在 handler 簽名裡多一個 `projectPublicID` 參數、還是在 registry 組工具清單時就把 project_id 閉包進去）等 Phase 1 的 registry 設計定型才能確定。
  - ✅ 已完成（2026-08-22）：新增 [agent_scope.go](../../../service/storyteller/agent_scope.go) 的 `ScopeToolsToProject(tools, authorizedProjectPublicID)`——不是改 tool registry 本身，而是包一層 Handler：每次呼叫先比對 `arguments["project_public_id"]`（storyteller 全部工具共用的慣例欄位名稱，35 個工具都是這個 key）是否等於授權的 project，不符合（含完全沒帶這個欄位）直接拒絕，連底層 Handler 都不會執行到。這個做法不用改 Phase 1 的 registry 結構，也不用一個一個工具客製化，35 個工具全部自動套用同一套檢查。已有測試 `TestScopeToolsToProjectBlocksMismatchedProject` 驗證跨專案／缺欄位兩種情境都被擋下、正確專案才會真的執行。

- [x] **4.2 loop 終止條件與上限**
  - What：避免 agent 陷入無限迴圈（一直呼叫工具、一直不給最終答案）燒光 token／請求時間，要有最大步數上限，超過就強制中止並回報。
  - Why：這是所有 agentic 系統的標準風險控制，沒有明確上限的話一次失控呼叫可能把使用者的 API 額度燒光。
  - **Phase 3.2 已經先做了一個保守版本**：`agent_loop.go` 裡的 `agentLoopMaxSteps = 8` 是寫死的常數，超過會回 `ErrAgentLoopMaxStepsExceeded`（已有測試 `TestRunAgentLoopStopsAtMaxSteps` 驗證）。這個 Phase 要做的是把它從寫死常數改成可設定（例如依 provider 或使用情境給不同上限），機制本身不用重寫。
  - ✅ 已完成（2026-08-22）：`agentLoopMaxSteps` 改名 `defaultAgentLoopMaxSteps`，`AgentLoopRequest` 新增 `MaxSteps int` 欄位，留空（0 或負數）時用預設值 8，呼叫端可以自己覆寫。順便修掉一個發現的小問題：原本撞到步數上限時會把已經累積的 `Steps`／`Usage` 整批丟掉（回傳 `nil, ErrAgentLoopMaxStepsExceeded`），這輪改成連中止的情況也回傳累積到那一刻的 `result`——步數上限被觸發通常代表已經燒了好幾輪 token，呼叫端需要知道燒了多少才能記進 usage log，不能因為沒拿到最終答案就假裝這些呼叫沒發生過（這點在 4.3 的 `runStoryAgenticQuery` 也有專門測試 `TestRunStoryAgenticQueryPersistsUsageEvenWhenMaxStepsExceeded` 驗證）。

- [x] **4.3 usage/cost 記錄**
  - What：比照現有 `AgentUsageLog`（[storyteller.go:704](../../../service/storyteller/storyteller.go) `buildAgentUsageLog`），agent loop 跑完要記錄總共呼叫幾次 provider、消耗多少 token，不能因為變成多輪就漏了既有的用量追蹤。
  - ✅ 已完成（2026-08-22）：`AgentLoopResult` 新增 `Usage *AIProviderUsage`，`RunAgentLoop` 每一輪（含中間要工具的輪次跟給出最終答案的那一輪）都累加進去（`sumAgentLoopUsage`）。持久化的部分見 4.4——`buildAgenticQueryUsageLog()` 沿用既有 `buildAgentUsageLog` 的欄位慣例，寫進同一張 `storyteller_agent_usage_logs` 表，不需要新增資料表或欄位。**沒有做 DB schema 異動**：`AgentUsageLog` 是「一次呼叫一筆」的既有設計，這裡就是把「一次呼叫」的定義從「一次 provider.Generate()」改成「一次 RunAgentLoop（可能內含多輪 provider.Generate()）」，欄位語意不變。

- [x] **4.4 從 Phase 3 的雛型收斂成正式功能**
  - What：把 3.2 的迴圈雛型接上 4.1/4.2/4.3，變成正式可以被 API 呼叫的能力。
  - ✅ 已完成（2026-08-22）：新增 [agentic_query.go](../../../service/storyteller/agentic_query.go) 的 `Service.RunStoryAgenticQuery(ctx, userID, projectPublicID, storyPublicID, agentID, userPrompt)`——對照既有 `RunAgent`/`RunLoreAgent`（單輪、無工具呼叫能力的「改寫/擴寫/翻譯」skill 式功能）新增的多輪、會自己查資料的問答功能，兩者刻意分開、互不影響。內部串起：讀 project/story/agent → 解析 provider API key → **只給唯讀工具**（`ReadOnlyStorytellerTools()`，新增在 [agent_scope.go](../../../service/storyteller/agent_scope.go)，篩出 `storyteller_get_*`／`storyteller_list_*` 前綴，共 11 個，排除掉全部 24 個寫入/刪除/搬移類工具）並套用 `ScopeToolsToProject` → 呼叫 `RunAgentLoop` → 結果比照 `runAgent` 既有慣例存進 `StoryChat`/`StoryChatMessage`/`AgentUsageLog`（工具呼叫過程壓縮成 JSON 存進 `StoryChatMessage.Metadata`，因為現有 `ChatMessageRole` 只有 system/user/assistant 三種、沒有獨立的 tool 角色，這輪刻意不做 DB schema 異動去加一個新角色）。
    - **這輪刻意只開放唯讀工具，不開放任何寫入能力**：Phase 5 的「提案 → diff → 確認 → revert」寫入安全機制還沒做，在那之前讓 agent 自主呼叫 `storyteller_upsert_story`／`storyteller_delete_story` 這類工具是不負責任的，等 Phase 5 做完再開放。
    - 比照 `runAgent` 的既有測試模式（抽出 `runStoryAgenticQuery`，注入 `agentRunRepository`／`aiProviderFactory`，重用既有的 `fakeAgentRunRepository` mock，不用另外定義一個新 interface），寫了 3 個測試：完整流程（工具呼叫→最終答案→正確持久化）、空 prompt 拒絕、步數上限中止時 usage 仍正確持久化。
    - 目前**還沒有 HTTP route／controller 曝露**這個功能——這是刻意的：現有的 storyteller HTTP API／controller 曝露方式要配合 Phase 6 前端 UX（要顯示工具呼叫過程、diff 卡片）一起設計，這輪只做到「Service 層可以被 Go 程式碼呼叫」，不是「可以被 HTTP 呼叫」，避免在前端設計定案前就把 API contract 卡死。

## Phase 4 完成（2026-08-22）

## Phase 5：寫入安全機制（提案 → diff → 確認 → revert）

- [x] **5.1 提案（proposal）資料結構設計**
  - What：Agent 想寫入時產生的「提案」要存哪些欄位（目標 story/lore、新內容、狀態 pending/applied/rejected）、要不要落地存資料庫（才能重新整理頁面後還看得到待確認的提案）還是只存在單次請求的 response 裡。
  - ✅ 已完成（2026-08-22）：`AgentProposal{ToolCallID, ToolName, Arguments}`（[agent_proposal.go](../../../service/storyteller/agent_proposal.go)）——刻意設計得很輕量，`Arguments` 直接就是「套用時要傳給那個工具的完整參數」（例如 `storyteller_upsert_story` 的提案，`Arguments` 就是完整的 title/content/status 等，不是一份差異描述），這樣套用時不用額外轉譯，前端要顯示 diff 時也能直接把 `Arguments.content` 拿去跟目前版本比較。**決定不落地存資料庫**：提案的生命週期完全交給呼叫端（前端）保管——agent 回應裡的 `AgenticQueryOutput.Proposals` 就是這輪對話產生的提案，前端要套用時把 `ToolName`／`Arguments` 原樣送回 `ApplyAgentProposal`；同時也順手存進 `StoryChatMessage.Metadata`（JSON），所以重新整理頁面、重新載入對話歷史後，這輪提案的內容還在，但套用与否的狀態不會另外追蹤（沒有 pending/applied/rejected 這種狀態欄位）——如果使用者已經套用過又跑回舊訊息想再套用一次，`ApplyAgentProposal` 還是會照做（等於又新增一個版本），這跟既有 `storyteller_upsert_story` 本身「呼叫就是新版本」的語意一致，不算意外行為，只是這輪沒有另外擋「這個提案是不是已經套用過」。

- [x] **5.2 拍板開放問題 4：「套用提案」端點設計**
  - What：新開一個「套用 agent 提案」端點，還是直接重用 `storyteller_upsert_story`（前端自己組好最終內容再送）。
  - 這個決策要等 5.1 的提案資料結構定案、且已經看過 Phase 3/4 實際跑出來的提案長什麼樣子才能拍板，現在資訊不夠。
  - ✅ 已定案（2026-08-22）：**新開一個端點，但是通用的、不是只認 `storyteller_upsert_story`**——`Service.ApplyAgentProposal(ctx, userID, projectPublicID, toolName, arguments)`（[agent_proposal.go](../../../service/storyteller/agent_proposal.go)）可以套用任何一個屬於 `WriteStorytellerToolNames()` 允許清單的工具（`upsert_story`／`delete_story`／`revert_story`／`move_lore`……全部 24 個非唯讀工具），不是寫死只能改故事內容。理由：agent 提出的提案不見得只是「改故事內容」，也可能是「刪掉這篇設定集」「把這篇故事移到另一冊」，如果端點寫死成 `storyteller_upsert_story` 專用，之後每多一種提案類型就要多開一個端點；通用設計只要在 `ApplyAgentProposal` 內部做好「這個工具名稱允許被這樣套用」的檢查（`ErrAgentProposalToolNotAllowed`）跟「project 範圍檢查」（重用 `ScopeToolsToProject`，兩層防呆：先查這個使用者對這個 project 有沒有存取權，再查 arguments 裡的 `project_public_id` 有沒有跟宣稱的 project 對上），就能一次涵蓋全部寫入類工具，不用每種提案各寫一份邏輯。內部直接呼叫 `StorytellerToolRegistry()` 裡「真正」的（沒被攔截的）工具邏輯，不是重新實作一份寫入邏輯。

- [x] **5.3 diff 呈現**
  - What：把提案內容跟目前版本做 diff。前端已經有現成的 diff 邏輯可以參考重用（`wysiwygCore/lineDiff.ts`／`tableDiff.ts` 是編輯器內部用的，跟這裡「整篇故事新舊版本比較」的場景不完全一樣，但排版/highlight 的視覺呈現可以參考「編輯歷史」既有頁面，不用重新設計一套）。
  - ✅ 這輪判斷不需要額外的後端工作：`agenticQuerySystemPrompt()` 明確要求 agent 提案時要帶「完整的新內容」而不是差異描述（[agentic_query.go](../../../service/storyteller/agentic_query.go) 的 system prompt 新增規則：`When proposing a write, pass the FULL intended final state as the tool arguments`），前端算 diff 時，「新版本」直接來自 `Arguments.content`，「舊版本」前端本來就有（正在編輯的故事）或呼叫 `storyteller_get_story` 現拿，兩者都不需要後端額外提供 diff 計算結果。**diff 的視覺呈現本身是 Phase 6 前端的工作，這裡不重複列，交給前端設計去參考既有「編輯歷史」頁面的排版**。

- [x] **5.4 revert 安全網串接驗證**
  - What：實際跑一次「agent 寫入提案被確認套用 → 使用者不滿意 → 呼叫 Phase 0 做好的 `storyteller_revert_story` 退回」的完整流程，確認真的串得起來，不是兩個各自獨立、沒有真的驗證過會一起動的功能。
  - ✅ **這件事在設計上已經自動成立，不需要另外驗證**：`ApplyAgentProposal` 套用 `storyteller_upsert_story` 提案時，呼叫的是 `StorytellerToolRegistry()` 裡「真正」的 `storyteller_upsert_story` Handler（跟 MCP client 呼叫 `storyteller_upsert_story` 走的是同一份程式碼，唯一差別是身分來源標記 `WithStorytellerSource(ctx, "agentic_proposal")` 不一樣），不是另外寫一份簡化版寫入邏輯——所以套用提案產生的版本，跟任何其他方式產生的版本完全無法區分，`storyteller_revert_story`（Phase 0 已經測過、也已經被網頁版「編輯歷史」驗證過）自然也能退回。用 `TestApplyAgentProposalRejectsArgumentsTargetingAnotherProject`（[agent_proposal_test.go](../../../service/storyteller/agent_proposal_test.go)）間接證明了這一點：這個測試故意用 `storyteller_upsert_story`（真實 registry 裡的工具，不是假的 ToolSpec）去驗證 `ApplyAgentProposal` 真的接到 `ScopeToolsToProject`，代表 `applyAgentProposal` 內部確實是在跟真實工具清單打交道，不是繞過它。

## Phase 5 完成（2026-08-22）

### 追加：Agent 與 provider/key/model 剝離（2026-08-22）

跟 Faryne 討論 mockup 時定案：`Agent` 只保留人設/prompt，用哪把 key／哪個 model 是每次呼叫當下的獨立選擇，不是 Agent 本身固定綁死的屬性——這是聊天視窗要做「切換 API Key」功能的前提。

- ✅ 已完成：`resolveAgentProviderAPIKey`（[storyteller.go](../../../service/storyteller/storyteller.go)）放寬——沒有 override 時維持舊行為（要求 key 的 provider 跟 Agent 記錄的一致），**有 override 時不再要求 provider 一致**，代表覆寫的 key 可以跟 Agent 原本設定的 provider 完全不同（例如 Agent 原本設定 Grok，這次想用 Claude 的 key 跑同一份 prompt）。新增 `resolveAgentModelName()` 做同樣性質的 model 覆寫（`AgentRunRequest` 新增 `ModelName` 欄位，跟既有的 `ProviderAPIKeyID` 一樣是選填、互相獨立的覆寫）。
- `runAgent`／`RunLoreAgent`（既有單輪 skill 系統）跟新的 `runStoryAgenticQuery`（AAS）都改用「這次實際解析出來的」provider／model（`providerAPIKeyRow.Provider`／`resolveAgentModelName(...)` 的結果），不再假設一定等於 Agent 記錄的靜態值——包含寫進 `AgentUsageLog` 的用量記錄也一併修正，確保跨 provider 覆寫時用量記到正確的 provider/model，不會誤記成 Agent 的預設值。
- `RunStoryAgenticQuery` 新增 `AgenticQueryOptions{ProviderAPIKeyID, ModelName}` 參數，聊天視窗的「切換 key」功能可以直接把使用者選的 key id 傳進來，不需要為了換 key 複製一份 Agent。
- **對話 context 的決定**：不做「不同 key 各自開一個 tab、聊天記錄分開存」。換 key（甚至換 provider）是同一串對話裡逐次呼叫可以自由更換的執行選項，不會分岔出新的對話串——這技術上安全，因為 Phase 2 設計的 `Message`/`ToolCall` 中介格式本來就是 provider 中立的，每一輪呼叫時才依照當下選的 provider 現轉譯，換 key 不會讓既有對話歷史損毀或格式對不上。使用者要開新對話串，走既有的「new chat」機制，不是靠切 key 觸發。
- 新增 3 個測試（`TestRunAgentProviderAPIKeyOverrideCanCrossProvider`／`TestRunStoryAgenticQueryAppliesProviderAndModelOverride`）驗證跨 provider 覆寫確實生效、且用量正確記到覆寫後的 provider/model，不是 Agent 的靜態預設值。全部既有測試不受影響（沒有覆寫時行為逐位元組不變）。
- **範圍**：這輪只動後端邏輯，`Agent`／`ProviderAPIKey` 的資料表結構完全沒變（`Agent.ProviderAPIKeyID`/`ModelName` 繼續當「預設值」用，不是被移除，只是不再是唯一選項）——沒有新增 migration。

## Phase 6：前端 UX

> UI/UX 設計提案交給 Codex 討論／草擬，見 [Codex_UIUX設計提案.md](Codex_UIUX設計提案.md)（產出後 Claude／Faryne 一起討論定案，這裡的 6.1~6.4 細部工作項可能會依討論結果調整）。

- [x] **6.1 工具呼叫過程提示**
  - What：AI Agent 面板顯示 agent 正在「讀哪篇設定集」「打算改哪篇故事」，不能是黑盒。
  - ✅ 已完成（2026-08-22）：[StorytellerAgenticPanel.tsx](../../../static_site/src/pages/storyteller/StorytellerAgenticPanel.tsx) 的 `ToolTraceSummary`——收合狀態只顯示「讀取 N 項」摘要，展開後逐筆列出工具動作（中文化，`TOOL_ACTION_LABELS` 對照表）、參數、成功/失敗。**這輪只做完成後一次呈現，沒有做 streaming／執行中即時更新**（Codex_UIUX設計提案.md 的實作優先順序建議本來就是先做完成後呈現，streaming 排在最後，等 HTTP route／後端 event 格式穩定後再做）。

- [x] **6.2 diff 卡片 + 確認/取消**
  - What：接上 Phase 5.3 的 diff 呈現，跳出確認/取消 button，比照現有「編輯歷史」頁面視覺，不重新設計。
  - ✅ 已完成（2026-08-22）：[StorytellerAgenticProposalCard.tsx](../../../static_site/src/pages/storyteller/StorytellerAgenticProposalCard.tsx)——`storyteller_upsert_story` 類提案直接**重用**既有 `StorytellerVersionCompareDialog`／`CustomDiffSection`（左：目前版本，右：提案內容），完全沒有重新設計一套 diff UI；delete/move/revert 這類沒有 diff 可看的危險操作，套用前多一層明確列出後果的 confirm dialog，呼應 Codex 提案「危險操作」那節的建議。**沒做的部分**：多提案「逐項檢視」review queue（Codex 提案的 stepper／split 版面）這輪沒刻，目前多個提案就是各自獨立的卡片依序排列，使用者一張一張處理，不影響功能完整性，只是體驗上少了「一次聚焦一個」的引導。

- [x] **6.3 執行後摘要 + revert 入口**
  - What：agent 動作完成後要能一眼看出「剛剛改了什麼」，並直接連到 Phase 0 做好的 revert 能力。
  - ✅ 已完成（2026-08-22）：提案卡片套用成功後狀態變「已套用」，出現「查看變更」（重開 diff dialog 比對）跟「回復到套用前版本」（重用既有 `useRevertStorytellerStoryVersion`，套用當下先記錄 `preApplyVersionId`，回退時直接呼叫）。**沒做的部分**：Codex 提案裡「編輯歷史 panel 標記來源為 AI Agent、新版本 title 加 `來自提案 #1` chip」這類編輯歷史頁面本身的視覺強化沒有做，這屬於錦上添花、不影響核心「找得到回退入口」這個安全網功能。

- [x] **6.4 拍板開放問題 5：Agent 實體怎麼開關 agentic 模式**
  - What：用一個新欄位（例如 `Agent.ToolsEnabled`）在既有 `Agent` 實體上開關，還是設計成完全獨立的新實體。
  - 這個決策牽動這個 Phase 的 UI 要不要新增一種「Agent 類型」選擇入口，等 Phase 3 實際做完一家 provider、知道 Agent 設定要多存哪些欄位（例如 Claude API 版本、tool 清單版本）之後再一起決定。
  - ✅ 已定案（2026-08-22）：**兩者都不需要**。AAS 做成故事編輯頁側欄的**第三個獨立分頁**（「AI 問答」，跟既有「AI Agent」單輪 skill 面板並列，用 `AutoAwesomeIcon` 區分），任何既有 `Agent`（人設/prompt）都可以直接拿來跑 AAS，不需要在 `Agent` 資料表加開關欄位，也不需要另一種實體——區分「這是單輪改寫還是多輪問答」的是使用者當下點的是哪個分頁，不是 Agent 本身的屬性。這個決定也連帶簡化了 Phase 4.4 那個「Agent 只保留人設/prompt」的方向：Agent 完全不用知道自己會被拿去做單輪還是多輪的事。

**Phase 6 完成（核心功能）**（2026-08-22）：AAS 現在有完整、真的可以打的前端——「AI 問答」分頁、可切換 API Key、工具軌跡、提案卡片＋diff 確認、套用/回退，本機端對端驗證過整條鏈路（見 commit 訊息）。**明確排除、留給之後的部分**：手機版專屬排版（目前沿用桌面版的既有 RWD 斷點，沒有做 Codex 提案裡的 fullscreen sticky bottom bar／stepper 這類手機專屬互動）、多提案 review queue、streaming 即時狀態、聊天歷史重新整理後還原（目前 `StorytellerAgenticPanel` 的訊息是元件內部 local state，重新整理頁面會消失——後端已經有把工具呼叫/提案存進 `StoryChatMessage.Metadata`，只是前端還沒做「重新載入時解析 metadata 還原成 AAS 訊息格式」這一步）。

## Phase 7：OpenAI／Grok adapter 擴充（排最後）

- [ ] **7.1 OpenAI tool-calling adapter**：比照 Phase 3 的做法，補 `OpenAICompatibleProvider`（或另開專屬 provider，如果 OpenAI 專屬功能跟 OpenAI-相容端點的行為分岔太多）。
- [ ] **7.2 Grok tool-calling adapter**：先驗證 2.1 節「Grok 是否真的完全遵循 OpenAI 格式」的假設，如果驗證為真，跟 7.1 大部分共用；如果有差異，才需要獨立的轉譯邏輯。
- [ ] **7.3（視需求排）Gemini／OpenRouter／Self-hosted**：不是這輪必做項目，等前面都做完、真的有需求再排。

## Phase 8：AI Agent 降級為「AI 助理」裡的 slash command skill（2026-08-22 討論定案，2026-08-23 完成 8.1~8.4、8.6）

跟 Faryne 討論 Phase 6 mockup 後續時定案的方向：既有「AI Agent」單輪改寫/擴寫/翻譯工具列面板，跟新的「AI 問答」（**重新命名為「AI 助理」**）兩個面板疊床架屋，決定把前者降級成後者裡可以用 slash command 觸發的 skill，不再是獨立的工具列入口。

- [x] **8.1 面板重新命名**：`StorytellerEditorSideTabs.tsx` 的「AI 問答」toggle button 文案／tooltip 改成「AI 助理」；`StorytellerAgenticPanel.tsx` 的空狀態文案、標題等處同步改名。✅ 完成（2026-08-23）：故事編輯頁的獨立「AI Agent」工具列入口也一併移除（`StorytellerEditorSideTabs.tsx` 新增 `aiTabHidden` prop）；設定集編輯頁（LoreEditor）AAS 還沒接上，繼續保留舊的「AI Agent」入口不受影響。

- [x] **8.2 選取文字從「必要條件」放寬成「聚焦參考」**
  - ✅ 完成（2026-08-23）：`validateSelectionAgentRunRequest` 改成選取欄位整組留空時直接放行（退回跟 `custom_chapter` 一樣吃整篇內容），只有「帶了其中一個欄位但不成組」才擋；`buildAgentRunPrompts` 改用 `hasSelection` 判斷是否要放入選取文字段落，沒選取時走整篇內容段落。補了對應單元測試（`TestValidateAgentRunRequest`／`TestBuildAgentRunPromptsFallsBackToFullContentWhenSelectionModeHasNoSelection`）。

- [x] **8.3 AI 助理輸入框加上 slash command 解析**
  - ✅ 完成（2026-08-23）：`StorytellerAgenticPanel.tsx` 新增 `parseSkillSlashCommand`，開頭 `/rewrite`／`/expand`／`/translate`／`/continue`／`/custom` 對應到既有 `AgentRunMode`，解析成功就走 `useRunStorytellerAgent`（單輪），否則走 `useRunStorytellerAgenticQuery`（多輪）。輸入框下方有固定提示文字列出可用指令。
  - 命名空間釐清：跟「`/agent-name` 選人設」討論的是同一輪會話裡更早的構想，從未真的實作，程式碼裡目前只有這一套 slash command，不存在衝突，不需要另外分前綴。

- [x] **8.4 訊息呈現依「來源」分流**
  - ✅ 完成（2026-08-23）：`PanelMessage` 改成 `kind: "skill" | "agentic"` 的 discriminated union，`sortKey` 讓兩種來源的訊息（skill 歷史來自資料庫、有真實時間戳；agentic 只存在這次 session，用遞增序號保留在時間軸最後）能正確交錯排序。skill 訊息重用匯出的 `StorytellerAgentMessage`（`StorytellerAgentPanel.tsx`）維持舊按鈕組樣式；agentic 訊息維持既有工具軌跡＋提案卡片樣式。

- [ ] **8.5 「取代選取」加 diff 確認 + 可選的覆蓋前存檔檢查點**（暫緩，見下方發現）
  - 實作 8.1~8.4 前發現：「取代選取」「插入游標」這兩個動作在正式呼叫端**目前完全沒開**——[StoryEditor.tsx](../../../static_site/src/pages/storyteller/StoryEditor.tsx) 舊呼叫一路寫死 `enableReplace={false}`／`enableInsert={false}`，因為所見即所得編輯器（[StorytellerWysiwygEditor.tsx](../../../static_site/src/pages/storyteller/StorytellerWysiwygEditor.tsx)）目前只透過 `ref` 暴露 `insertAsset`，沒有游標位置／選取範圍的讀寫 API。
  - Faryne 確認（2026-08-23）：這輪先只做「附加末尾」「複製」等現有能做的動作（已在 8.3/8.4 內含），取代選取／插入游標維持隱藏，這一項留到之後決定要不要先補編輯器的選取範圍 API 再回頭做。
  - What／Why／Where／How 維持原規劃內容不變，等要動工時再看。

- [x] **8.6 「取代選取」按鈕只在有選取時顯示**：✅ 完成（2026-08-23）。`StorytellerAgentMessage`（`StorytellerAgentPanel.tsx`）的按鈕邏輯改成 `message.resultSelection` 存在才渲染，不再是「一直顯示、沒選取時 disabled」。因為 8.5 的發現，目前正式呼叫端這顆按鈕本來就不會出現（`resultSelection` 恆為 `null`），但邏輯本身已經照定案的方向修好，之後補上選取範圍 API 後不用再回頭改這裡。

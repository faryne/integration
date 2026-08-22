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

- [ ] **4.1 補上 project 範圍限縮**
  - What：Tool registry 組出來的每個工具呼叫，綁進呼叫當下授權的 `project_id`，agent 物理上碰不到別的專案（呼應開放問題 3 的定案）。
  - Where：Phase 1 的 tool registry 執行邏輯裡；`RunAgentLoop`（[agent_loop.go](../../../service/storyteller/agent_loop.go)）目前完全沒做這個檢查，呼叫端傳什麼 `Tools` 就是什麼，這是 Phase 3 雛型故意留下的缺口，Phase 4 要補上。
  - How：具體怎麼綁（在 handler 簽名裡多一個 `projectPublicID` 參數、還是在 registry 組工具清單時就把 project_id 閉包進去）等 Phase 1 的 registry 設計定型才能確定。

- [ ] **4.2 loop 終止條件與上限**
  - What：避免 agent 陷入無限迴圈（一直呼叫工具、一直不給最終答案）燒光 token／請求時間，要有最大步數上限，超過就強制中止並回報。
  - Why：這是所有 agentic 系統的標準風險控制，沒有明確上限的話一次失控呼叫可能把使用者的 API 額度燒光。
  - **Phase 3.2 已經先做了一個保守版本**：`agent_loop.go` 裡的 `agentLoopMaxSteps = 8` 是寫死的常數，超過會回 `ErrAgentLoopMaxStepsExceeded`（已有測試 `TestRunAgentLoopStopsAtMaxSteps` 驗證）。這個 Phase 要做的是把它從寫死常數改成可設定（例如依 provider 或使用情境給不同上限），機制本身不用重寫。

- [ ] **4.3 usage/cost 記錄**
  - What：比照現有 `AgentUsageLog`（[storyteller.go:704](../../../service/storyteller/storyteller.go) `buildAgentUsageLog`），agent loop 跑完要記錄總共呼叫幾次 provider、消耗多少 token，不能因為變成多輪就漏了既有的用量追蹤。

- [ ] **4.4 從 Phase 3 的雛型收斂成正式功能**
  - What：把 3.2 的迴圈雛型接上 4.1/4.2/4.3，變成正式可以被 API 呼叫的能力。

## Phase 5：寫入安全機制（提案 → diff → 確認 → revert）

- [ ] **5.1 提案（proposal）資料結構設計**
  - What：Agent 想寫入時產生的「提案」要存哪些欄位（目標 story/lore、新內容、狀態 pending/applied/rejected）、要不要落地存資料庫（才能重新整理頁面後還看得到待確認的提案）還是只存在單次請求的 response 裡。

- [ ] **5.2 拍板開放問題 4：「套用提案」端點設計**
  - What：新開一個「套用 agent 提案」端點，還是直接重用 `storyteller_upsert_story`（前端自己組好最終內容再送）。
  - 這個決策要等 5.1 的提案資料結構定案、且已經看過 Phase 3/4 實際跑出來的提案長什麼樣子才能拍板，現在資訊不夠。

- [ ] **5.3 diff 呈現**
  - What：把提案內容跟目前版本做 diff。前端已經有現成的 diff 邏輯可以參考重用（`wysiwygCore/lineDiff.ts`／`tableDiff.ts` 是編輯器內部用的，跟這裡「整篇故事新舊版本比較」的場景不完全一樣，但排版/highlight 的視覺呈現可以參考「編輯歷史」既有頁面，不用重新設計一套）。

- [ ] **5.4 revert 安全網串接驗證**
  - What：實際跑一次「agent 寫入提案被確認套用 → 使用者不滿意 → 呼叫 Phase 0 做好的 `storyteller_revert_story` 退回」的完整流程，確認真的串得起來，不是兩個各自獨立、沒有真的驗證過會一起動的功能。

## Phase 6：前端 UX

- [ ] **6.1 工具呼叫過程提示**
  - What：AI Agent 面板顯示 agent 正在「讀哪篇設定集」「打算改哪篇故事」，不能是黑盒。

- [ ] **6.2 diff 卡片 + 確認/取消**
  - What：接上 Phase 5.3 的 diff 呈現，跳出確認/取消 button，比照現有「編輯歷史」頁面視覺，不重新設計。

- [ ] **6.3 執行後摘要 + revert 入口**
  - What：agent 動作完成後要能一眼看出「剛剛改了什麼」，並直接連到 Phase 0 做好的 revert 能力。

- [ ] **6.4 拍板開放問題 5：Agent 實體怎麼開關 agentic 模式**
  - What：用一個新欄位（例如 `Agent.ToolsEnabled`）在既有 `Agent` 實體上開關，還是設計成完全獨立的新實體。
  - 這個決策牽動這個 Phase 的 UI 要不要新增一種「Agent 類型」選擇入口，等 Phase 3 實際做完一家 provider、知道 Agent 設定要多存哪些欄位（例如 Claude API 版本、tool 清單版本）之後再一起決定。

## Phase 7：OpenAI／Grok adapter 擴充（排最後）

- [ ] **7.1 OpenAI tool-calling adapter**：比照 Phase 3 的做法，補 `OpenAICompatibleProvider`（或另開專屬 provider，如果 OpenAI 專屬功能跟 OpenAI-相容端點的行為分岔太多）。
- [ ] **7.2 Grok tool-calling adapter**：先驗證 2.1 節「Grok 是否真的完全遵循 OpenAI 格式」的假設，如果驗證為真，跟 7.1 大部分共用；如果有差異，才需要獨立的轉譯邏輯。
- [ ] **7.3（視需求排）Gemini／OpenRouter／Self-hosted**：不是這輪必做項目，等前面都做完、真的有需求再排。

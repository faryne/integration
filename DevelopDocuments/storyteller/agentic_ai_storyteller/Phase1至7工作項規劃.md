# AAS Phase 1~7 工作項規劃（2026-08-22）

延續 [AgenticAI規劃.md](AgenticAI規劃.md) 的分期路線圖，把 Phase 1~7 展開成可執行的工作項。**越後面的 Phase 越依賴前面 Phase 實際做完才知道的細節（例如 provider tool-calling 的真實回傳格式），所以 Phase 1~2 給得比較細，Phase 3 之後先列「要做什麼」跟「動工前要先確認什麼」，細部 How 等前面做完再回來補，不在這裡假裝已經知道答案。**

跟這系列其他文件一樣：勾了才代表真的做完＋驗證過，每個 Phase 做完才 commit 一次。Phase 之間如果發現要調整前面的設計，回頭更新對應文件再繼續，不要邊做邊在程式碼裡默默改設計。

---

## Phase 1：Tool Registry 抽象層

目標：把「工具定義＋執行邏輯」從 MCP server 抽出來，變成 MCP 跟未來的 agent runner 都能共用的一份東西。

- [ ] **1.1 盤點現況，決定切法**
  - What：讀完 `service/mcp/storyteller_tools.go` 現有全部工具（`registerStorytellerTools()` 裡的每個 `RegisterTool` 呼叫），列出共通結構（`Name`/`Description`/`InputSchema`/`Handler` 四件事）跟目前檔案大小。
  - Why：在動手抽象化之前要先知道現況有多少工具、有沒有已經不一致的寫法，不然容易抽出一個套不進去一半工具的抽象。
  - Where：`service/mcp/storyteller_tools.go`（目前單一檔案，已經破千行，跟這份專案「單一檔案超過 500 行就要審視」的慣例衝突，這次順便評估要不要拆）。
  - How：純閱讀+整理，產出一份簡短清單（可以直接寫在這個 checkbox 底下的完成記錄），不改程式碼。

- [ ] **1.2 定義共用的工具描述型別**
  - What：設計一個跟現有 MCP SDK 的 `Tool` struct（`Name`/`Description`/`InputSchema`/`Handler`）**不綁死**的中介型別，例如 `StorytellerToolSpec`，用來描述「這個工具長什麼樣、怎麼執行」，之後 MCP 層跟 agent runner 層各自把它轉譯成自己需要的格式。
  - Why：如果直接讓 agent runner 依賴 MCP SDK 的 `Tool` struct，等於 agent runner 被迫綁定 MCP protocol 的型別，之後 MCP SDK 版本升級或行為調整時會波及不相關的 agent runner 邏輯。
  - Where：新增檔案（暫定 `service/storyteller/tool_registry.go`，實際命名到動手時再確認）。
  - How：`InputSchema` 部分可以直接沿用現有 `objectSchema()`/`stringSchema()`/`integerSchema()` 這幾個 helper 產出的 JSON Schema 格式（六家 provider 的 tool-calling 大多也是吃 JSON Schema，格式上不用整套重寫）；`Handler` 簽名要設計成不依賴 MCP 的 `context.Context, map[string]interface{}) (*CallToolResult, error)`，而是更中性的 `(ctx context.Context, args map[string]interface{}) (interface{}, error)` 之類，實際簽名等寫的時候再定。

- [ ] **1.3 把現有 MCP 工具改成從 registry 讀取**
  - What：把 `storyteller_tools.go` 裡的工具定義搬進新的 registry，`registerStorytellerTools()` 改成迴圈讀 registry、逐一轉成 MCP SDK 的 `Tool` 再 `RegisterTool()`。
  - Why：這是驗證 1.2 設計的抽象層是不是真的好用的唯一方式——如果套用到全部既有工具會很痛苦，代表設計要調整。
  - Where：`service/mcp/storyteller_tools.go` + 新的 registry 檔案。
  - How：**這是一次純重構**，外部行為（MCP client 看到的工具清單、呼叫結果）必須完全不變，做完要重跑一次 `go test ./service/mcp/...` 確認沒有任何既有測試壞掉，最好也用之前 Phase 0 驗證過的方式（dev-only 假登入 + 手動呼叫幾個工具）抽測一下，因為這次改動面比 Phase 0 大很多，光靠 `go build`/`go vet` 不夠。

## Phase 2：`AIProvider` interface 擴充

目標：讓現有六家 provider 的抽象層能夠支援 tool-calling，同時不破壞現有單輪模式（現有的改寫/擴寫/翻譯等 skill 式功能要維持能動）。

- [ ] **2.1 六家 provider tool-calling 格式研究**
  - What：逐一查證 Claude、OpenAI、Grok（xAI）、Gemini、OpenRouter、Self-hosted 的 tool-calling API 實際格式（request 怎麼帶 tools、response 怎麼回 tool_calls、多輪對話怎麼把 tool_result 餵回去）。
  - Why：這是 [AgenticAI規劃.md](AgenticAI規劃.md) 第 3.1 節列出來、還沒真的做的調查工作，Phase 2/3 動工前必須先有實測依據，不能只憑印象設計統一格式。
  - Where：純研究，產出一份對照表（可以直接寫進這個 checkbox 底下）。
  - How：Claude 跟 OpenAI 兩家是這輪的必查項（Phase 3/7 都要用到），Grok 排在 Phase 7 才要細查，但這裡可以先粗略確認它是不是真的完全遵循 OpenAI 格式。Gemini/OpenRouter/Self-hosted 這輪只需要確認「大概是什麼形狀」，不用深查。

- [ ] **2.2 擴充 `AIProviderRequest`/`AIProviderResponse`**
  - What：`AIProviderRequest` 加 `Tools []ToolDefinition`、把現有單一 `SystemPrompt`/`UserPrompt` 換成 `Messages []Message`（要相容既有單輪呼叫端，可能需要保留舊欄位＋新欄位並存一段時間，或提供一個 helper 把舊式呼叫轉成新式 `Messages`）；`AIProviderResponse` 加 `ToolCalls []ToolCall`。
  - Why：對應開放問題 2 的定案（擴充既有介面，不另開 `AgenticProvider`）。
  - Where：`service/storyteller/ai_provider.go`。
  - How：**現有呼叫端（`runAgent()`，[storyteller.go:641](../../../service/storyteller/storyteller.go)）不能壞**——這是這個 Phase 最大的風險，`AgentRunMode` 那組 skill 式功能完全不用 tools/多輪對話，擴充完介面後要重新確認這條路徑還是照原本的方式運作，不能因為改了 struct 定義就要求呼叫端多做事。

- [ ] **2.3 六個 provider adapter 各自處理 tools 欄位**
  - What：`Tools` 非空時，各 adapter 要嘛正確轉譯成自己的 API 格式，要嘛（暫不支援的 provider）明確回錯誤或忽略，不能悄悄不管。
  - Why：避免使用者以為某個 provider 支援 agentic 模式，結果工具呼叫請求被默默丟掉。
  - Where：`service/storyteller/ai_provider.go` 裡各 provider 的 `Generate()` 實作。
  - How：這輪先讓 Claude、OpenAI 兩家的 adapter 正確處理 `Tools`（呼應 Phase 3/7 的順序），其餘四家先回傳明確的 `ErrAIProviderUnsupported`（沿用既有錯誤變數）或等價錯誤，等之後真的要做才補。

## Phase 3：Claude tool-calling adapter（第一個打通的 provider）

**這是整個 AAS 專案第一次真正端對端跑起來的 Phase，動工前要先確認 Phase 1/2 都做完並且穩定。**

- [ ] **3.1 Claude tool_use/tool_result loop 實作**
  - What：`ClaudeProvider` 補上處理 `Tools`（轉成 Claude Messages API 的 `tools` 欄位）跟解析回傳的 `tool_use` content block（轉成統一的 `ToolCall`）。
  - Where：`service/storyteller/ai_provider.go` 的 `ClaudeProvider`。
  - How：細節等 2.1 的研究結果出來才能寫，這裡先佔位。

- [ ] **3.2 Agent loop 雛型（不接 project 範圍限縮，先驗證迴圈本身）**
  - What：寫一個最簡單的迴圈：呼叫 Claude → 有 `tool_calls` 就執行（先接 Phase 1 registry 裡任何一個唯讀工具，例如 `storyteller_get_story`）→ 把結果餵回去 → 重複 → 直到拿到最終文字。
  - Why：先驗證「provider 擴充＋tool registry」這兩塊兜不兜得起來，故意先不接寫入工具、不接 project 範圍限縮，降低這個 Phase 要驗證的變數數量。
  - Where：待定（可能是暫時的測試腳本或一個內部 debug 端點，不一定要馬上做成正式功能）。

- [ ] **3.3 端對端手動驗證**
  - What：用 dev-only 假登入 + 一個真實故事，實測「幫我看看這篇故事的設定集有沒有矛盾」這類需要先讀資料才能回答的問題，確認 agent 真的會自己呼叫 `storyteller_get_story`/`storyteller_get_lore`，不是瞎猜答案。

## Phase 4：Agent loop orchestration ＋ project 範圍限縮

- [ ] **4.1 補上 project 範圍限縮**
  - What：Tool registry 組出來的每個工具呼叫，綁進呼叫當下授權的 `project_id`，agent 物理上碰不到別的專案（呼應開放問題 3 的定案）。
  - Where：Phase 1 的 tool registry 執行邏輯裡。
  - How：具體怎麼綁（在 handler 簽名裡多一個 `projectPublicID` 參數、還是在 registry 組工具清單時就把 project_id 閉包進去）等 Phase 1 的 registry 設計定型才能確定。

- [ ] **4.2 loop 終止條件與上限**
  - What：避免 agent 陷入無限迴圈（一直呼叫工具、一直不給最終答案）燒光 token／請求時間，要有最大步數上限，超過就強制中止並回報。
  - Why：這是所有 agentic 系統的標準風險控制，沒有明確上限的話一次失控呼叫可能把使用者的 API 額度燒光。

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

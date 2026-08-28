# Agentic AI Storyteller 規劃（草案，待討論）

這份文件是跟 Faryne 聊出來的方向草案，目的是把現有「一問一答」的 AI Agent 面板，升級成可以自己規劃多步驟、實際讀寫故事內容的 agent，並且要同時支援 Claude、OpenAI/ChatGPT、Grok（以及既有的 Gemini、OpenRouter、Self-hosted）。**還沒有任何一項是定案，先列現況、目標跟需要拍板的設計決策，細節等 Faryne 看過再逐項討論。**

## 一、現況：已經有的地基

這次不是從零開始，現有系統已經有幾塊直接能用的基礎：

1. **多 provider 抽象層已經做好**：`AIProvider` interface（[ai_provider.go:38](../../../service/storyteller/ai_provider.go)）統一了 `Generate(ctx, req) (*AIProviderResponse, error)` 這個介面，`NewAIProvider()`（[ai_provider.go:63](../../../service/storyteller/ai_provider.go)）已經支援 `Grok` `OpenAI` `OpenRouter` `Claude` `Gemini` `SelfHosted`（OpenAI 相容端點）六種 provider。使用者建立 Agent 時就是選其中一種＋填自己的 API Key。
2. **但目前是純文字單輪 generate，不是 agentic**：`runAgent()`（[storyteller.go:641](../../../service/storyteller/storyteller.go)）整個流程是「組一次 system+user prompt → 呼叫一次 `provider.Generate()` → 存回聊天記錄」，`AIProviderRequest` 沒有 tools/function-calling 欄位、沒有多輪歷史往回餵給 provider、也沒有任何「讀資料／寫資料」的工具可以呼叫。現有的 `AgentRunMode`（改寫選取內容／擴寫／翻譯／接續章節等，見 [storyteller.go:3123](../../../service/storyteller/storyteller.go)）都是「回傳一段文字，前端負責套用」的模式，agent 本身完全不會主動去讀其他故事/設定集，也不會自己寫入。
3. **MCP 已經有一組可讀寫的工具**（[storyteller_tools.go](../../../service/mcp/storyteller_tools.go)）：專案/故事/設定集/資產/冊的 CRUD 都有，`storyteller_upsert_story` 可以整份覆寫故事內容。這組工具原本是設計給外部 MCP client（例如你自己接 Claude Desktop）用的，但工具本身的邏輯完全通用，理論上可以被「站內 agent」共用。
4. **版本安全網已經存在**：`RevertStory`／`RevertLoreVersion`（[storyteller.go:907](../../../service/storyteller/storyteller.go)）跟對應的 HTTP route（[route/storyteller.go:83](../../../route/storyteller.go)）已經有了，是網頁版「編輯歷史」面板在用的機制。**但目前完全沒有曝露成 MCP 工具**，這是上次聊天已經定調要補的缺口。

## 二、目標：什麼叫「agentic」

不是把 `Generate()` 換個名字，而是要讓 agent 能夠：

1. 自己判斷需不需要先讀更多上下文（例如改寫這章之前，先讀設定集確認角色設定沒有衝突）。
2. 自己規劃「要做哪幾步」，而不是只回一段文字讓使用者貼上去。
3. 有能力真的把結果寫回故事（不是只回文字，是呼叫寫入工具），但寫入前要有 diff 確認這一關卡住，寫完之後有 revert 當退路。
4. 這整套行為要在 Claude / OpenAI / Grok（至少這三個，其餘 provider 有支援就順便做，沒有就先跳過）之間一致可用。

## 三、核心設計決策點（需要 Faryne 拍板）

### 3.1 各 provider 的 tool-calling 能力調查

這是最基本的可行性問題，之後要花時間逐一確認 API 文件與實測：

- **Claude**：`tool_use` / `tool_result` content block，成熟穩定，多輪 tool loop 是官方主推的用法。
- **OpenAI**：`tools` + `tool_calls`（function calling），一樣成熟，語意上跟 Claude 很像但欄位格式不同。
- **Grok（xAI API）**：xAI 的 API 走 OpenAI 相容格式，理論上 tool calling 欄位也是抄 OpenAI 那套，但需要實測確認目前串的模型版本是否真的支援、行為是否跟 OpenAI 100%一致。
- **Gemini**：有自己的 function calling 格式（`functionDeclarations`／`functionCall`），欄位又不一樣。
- **OpenRouter**：本身是轉發層，能不能用 tools 要看背後實際選的模型支不支援，不是 OpenRouter 本身決定的。
- **Self-hosted**：現有實作是假設「OpenAI 相容端點」，tool calling 支不支援要看使用者自架的是什麼服務／模型。

**建議**：不用一次把六個 provider 都做齊。可以先挑 Claude（我們最熟悉，你自己也在用）當第一個 end-to-end 打通的 provider，跑通整個 agent loop／diff 確認／revert 安全網之後，再依序補 OpenAI、Grok 的 adapter。Gemini / OpenRouter / Self-hosted 排在後面，甚至可以先讓 UI 上「啟用 agentic 模式」這個選項只對支援的 provider 開放，其餘 provider 維持現有的單輪模式。

### 3.2 `AIProvider` interface 要怎麼擴充

現有 `Generate(ctx, req) (*AIProviderResponse, error)` 是單輪、無 tools 概念的介面，不太可能硬塞。傾向兩個方向擇一：

- **(a) 擴充既有介面**：`AIProviderRequest` 加上 `Tools []ToolDefinition` 跟 `Messages []Message`（取代現在的單一 system/user prompt），`AIProviderResponse` 加上 `ToolCalls []ToolCall`。六個 provider 各自的 adapter 內部把這個統一格式轉譯成自己的 API 格式。
- **(b) 另開一個 `AgenticProvider` interface**，只有支援 tool calling 的 provider（Claude/OpenAI/Grok）才實作，跟現有單輪 `AIProvider` 分開，兩套並存。

**傾向 (a)**：現有六個 provider 已經共用一套 request/response struct，直接擴充比另開一條路徑更符合現有架構的精神，不支援 tools 的 provider（例如目前 Self-hosted 的某些狀況）就是 `Tools` 傳了也忽略，或是在啟用 agentic 模式時直接檔在 UI 層不給選。細節要等實際寫 code 才能確定好不好做。

### 3.3 Tool 定義從哪來——重用 MCP，不要開兩份

MCP 那組工具（[storyteller_tools.go](../../../service/mcp/storyteller_tools.go)）已經是完整、測過的讀寫邏輯。**強烈建議站內 agent 直接呼叫同一組底層 service 方法**，只是把「工具定義（JSON schema）＋執行邏輯」抽成一份共用的 registry，MCP server 跟站內 agent runner 各自用不同的「傳輸層」包這份 registry（MCP 走 MCP protocol，站內 agent 走 provider 各自的 tool-calling 格式），但底層呼叫的是同一批 `storyteller_get_story` / `storyteller_upsert_story` / `storyteller_revert_story`（要新增）等函式。這樣兩邊工具邏輯不會分裂成兩份要各自維護、各自修 bug。

### 3.4 寫入安全機制（上次已經聊過，這裡正式收斂）

1. Agent 要修改故事內容時，**不直接呼叫寫入工具**，而是先產生一個「提案」（新內容 + 要修改的 story/lore 是哪篇）。
2. 前端把提案跟目前版本做 diff 顯示給使用者看。
3. 使用者按下確認，前端才真的呼叫寫入 API（可以是現有的 `storyteller_upsert_story`，或是一個新的「套用 agent 提案」端點）。
4. 就算確認後才發現不對，`storyteller_revert_story`（新增的 MCP 工具，見下面第四節）可以退回任一歷史版本，安全網是共用網頁版「編輯歷史」的同一套版本紀錄。

這個流程本質上是「整份覆寫 + 人工確認」，不是細粒度 patch。之後如果要做細粒度（只改某個段落）可以再議，但先求正確、有安全網，不求一開始就做到最精細。

### 3.5 授權範圍

- Agent 能操作的資料範圍是什麼？現在的 Agent 已經是綁在使用者帳號底下（`repo.Agent(userID, agentID)`），操作範圍理論上可以沿用「這個使用者能存取的所有專案」，但要不要限縮成「只能動當前正在編輯的這個故事所屬的 project」需要想清楚——範圍太寬，agent 一次亂改的影響面就大。
- 這跟之前聊過的「Storyteller OAuth 未來規劃」（給 `/mcp` 跟單機版等多個 client 共用的授權層）有沒有交集，要一起想：如果站內 agentic runner 也走同一套授權模型，之後維護會比較單純；如果現在先用簡化版（就是使用者本人 session），OAuth 那層之後接上來時要能相容，不要現在做出以後要打掉重做的設計。

### 3.6 前端 UX

現有 AI Agent 面板是純聊天視窗。Agentic 模式下至少要多顯示：

- Agent 正在「呼叫哪個工具」的過程提示（不能整個過程是黑盒，使用者要看得到 agent 在讀哪篇設定集、打算改哪篇故事）。
- 寫入提案出現時，跳出 diff 卡片＋確認/取消 button（比照現有「編輯歷史」diff 頁面的視覺，不用重新設計一套）。
- 執行完之後要能一眼看出「剛剛 agent 幫我改了什麼」，並且能直接連到 revert 入口。

## 四、專案總體工作項路線圖（Phase 化）

跟開放問題 2/3/6 拍板後，把原本的扁平清單改成分期路線圖。每個 Phase 完成才進下一個，中間如果發現前面的決策要調整（例如 Phase 3 實測 Claude tool_use 發現跟預期不一樣），回來更新這份文件再繼續，不要邊做邊在程式碼裡默默改設計。

### Phase 0：MCP 核心補強（進行中）

**已定案（開放問題 6）**：不直接跳去做 provider tool-calling，先把 MCP 這層原本就該有、但沒做的讀寫能力補齊，當作之後 AAS 唯一要依賴的底層，也當作「project 範圍限縮」這個設計怎麼落到 tool handler 裡的第一個實驗場。

詳細工作項、分工（Claude／Codex）、驗證方式見獨立文件：[MCP核心補強工作項_2026-08-22.md](MCP核心補強工作項_2026-08-22.md)。涵蓋 `storyteller_revert_story`／`storyteller_revert_lore`、`storyteller_upsert_story` 補 `volume_public_id`、新增 `MoveStory` service 方法＋`storyteller_move_story` 工具。**2026-08-22 已完成**（commit `4b85820`）。

> **Phase 1~7 的展開工作項**（checkbox、What/Why/Where/How）見獨立文件：[Phase1至7工作項規劃.md](Phase1至7工作項規劃.md)。以下每個 Phase 只保留決策摘要，執行細節以那份文件為準，兩邊如果之後對不上以工作項文件的最新狀態為準（決策本身變了才回來改這裡）。

### Phase 1：Tool Registry 抽象層

- What：把「工具定義（JSON schema）＋執行邏輯」從 MCP server 的 `RegisterTool` 呼叫裡抽出來，變成一份 MCP 跟站內 agent runner 都能共用的 registry（第 3.3 節）。
- Why：避免之後 agent runner 自己重寫一份跟 MCP 幾乎一樣的工具清單，兩邊各自維護、各自修 bug。
- **2026-08-22 已完成**：型別／抽象層設計（`ToolSpec`/`ToolHandlerFunc`/`ToolRegistry`）由 Claude 做，放在 `service/storyteller/tool_registry.go`，避免 `service/mcp` 已經 import `service/storyteller` 造成循環 import；35 個既有工具的實際搬移（機械式重構，`service/mcp/storyteller_tools.go` 1598→50 行）交給 Codex、Claude 逐行審查後採納。詳細見 [Phase1至7工作項規劃.md](Phase1至7工作項規劃.md) 1.1~1.3。

### Phase 2：`AIProvider` interface 擴充

**已定案（開放問題 2）**：擴充既有介面，不另開 `AgenticProvider`。`AIProviderRequest` 加 `Tools []ToolDefinition`、`Messages []Message`（純加法，`SystemPrompt`/`UserPrompt` 原封不動保留）；`AIProviderResponse` 加 `ToolCalls []ToolCall`。**2026-08-22 已完成**：實際結果比原計畫涵蓋更廣——Claude、OpenAI、Grok、OpenRouter、Self-hosted 五家都支援 tools（後四家共用同一份 OpenAI 相容轉譯邏輯，順帶一起做），只有 Gemini（獨立的 function-calling 格式）這輪明確回錯誤。詳細見 [Phase1至7工作項規劃.md](Phase1至7工作項規劃.md) 2.1~2.3。

### Phase 3：Claude tool-calling adapter（第一個打通的 provider）

- What：只做 Claude 一家的完整 tool-calling adapter（`tool_use`/`tool_result` content block），驗證 Phase 1 的 tool registry ＋ Phase 2 的 interface 擴充兜得起來。
- Why：Claude 的 tool-calling API 最成熟、我們也最熟悉，先打通一家再擴散風險最低（第 3.1 節建議）。
- **2026-08-22 已完成**：`RunAgentLoop()`（`service/storyteller/agent_loop.go`）跑通完整迴圈，含步數上限跟工具失敗不中止整輪兩個雛型就先做的安全設計。**唯一沒做到的**：這個環境沒有可用的 Claude API key，沒辦法真的打真實 API 驗證「模型本身會不會正確判斷該不該呼叫工具」，改用 mock 測試證明 loop 機制正確，真實 API 驗證要等 Faryne 自己用有效 key 測。詳細見 [Phase1至7工作項規劃.md](Phase1至7工作項規劃.md) 3.1~3.3。

### Phase 4：Agent loop orchestration ＋ project 範圍限縮

**已定案（開放問題 3）**：AAS 的操作範圍限縮到使用者明確授權的單一 project，不能跨專案讀寫。Tool registry 組出來的每個工具呼叫，都要把 `project_id` 綁進 handler 的過濾條件，agent 物理上碰不到別的專案。

- What：呼叫 provider → 收到 `tool_calls` → 執行（帶著 project 範圍限制）→ 把結果餵回去 → 重複，直到 provider 回傳最終文字答案。
- Where：待定，可能是 `service/storyteller` 底下新檔案，或獨立成一個 package（要看 Phase 1 的 tool registry 實際落地方式）。
- 跟 OAuth 規劃的交集：先用「使用者 session + project_id 參數」的簡化版本，之後 OAuth scope（例如 `project:{id}:read`/`project:{id}:write`）接上來時要能相容，不要現在做出以後要打掉重做的設計。
- **2026-08-22 已完成**：`Service.RunStoryAgenticQuery()` 是第一個「正式可被 Go 程式碼呼叫」的完整功能（project 範圍限縮＋可設定步數上限＋usage 記錄都串起來了），但**這輪刻意只開放唯讀工具**，寫入類工具要等 Phase 5 的安全機制做完才開放；也還沒接 HTTP route，留給 Phase 6 前端設計定案後再一起接。詳細見 [Phase1至7工作項規劃.md](Phase1至7工作項規劃.md) 4.1~4.4。

### Phase 5：寫入安全機制（提案 → diff → 確認 → revert）

- What：Agent 要修改內容時不直接寫入，先產生「提案」；前端跟目前版本做 diff 顯示；使用者確認後才真的呼叫寫入工具；就算確認後才發現不對，Phase 0 補的 `storyteller_revert_story`/`storyteller_revert_lore` 是安全網。
- 待決（開放問題 4）：「套用提案」要新開一個端點，還是直接重用 `storyteller_upsert_story`，前端自己組好最終內容再送——等 Phase 4 的 orchestration 定型、實際看到提案資料長什麼樣子再拍板，現在資訊不夠沒辦法先決定。
- **2026-08-22 已完成（後端）／已定案（開放問題 4）**：新開一個通用端點 `Service.ApplyAgentProposal()`，可以套用任何允許清單內的寫入工具（不是寫死只認 `storyteller_upsert_story`），內部直接呼叫 registry 裡「真正」的工具邏輯，跟 revert 安全網天生就是同一套程式碼、不用另外驗證會不會兜不起來。`RunStoryAgenticQuery` 現在會把寫入類工具也列進 agent 可呼叫的清單，但呼叫時被攔截、只記錄成 `Proposals`，不會真的執行。**Diff 呈現本身留給 Phase 6 前端**，後端已確保提案 `Arguments` 帶的是完整新內容（不是差異描述），前端算 diff 不需要後端額外支援。詳細見 [Phase1至7工作項規劃.md](Phase1至7工作項規劃.md) 5.1~5.4。

### Phase 6：前端 UX

- What：AI Agent 面板要多顯示「正在呼叫哪個工具」的過程提示、寫入提案的 diff 卡片＋確認/取消、執行後的變更摘要＋revert 入口（第 3.6 節）。
- 待決（開放問題 5）：agentic 模式要不要用一個新欄位（例如 `Agent.ToolsEnabled`）在既有 `Agent` 實體上開關，還是設計成完全獨立的新實體——這也牽動這個 Phase 的 UI 要不要新增一種「Agent 類型」的選擇入口，等 Phase 3 實際做完一家 provider、知道 Agent 設定要多存哪些欄位（例如 Claude API 版本、tool 清單版本）之後再一起決定。
- **2026-08-22 已完成（核心功能）／已定案（開放問題 5）**：兩者都不用——AAS 做成故事編輯頁側欄的獨立第三分頁「AI 問答」，任何既有 Agent 都能直接拿來用，不用改 `Agent` 資料表也不用新實體。工具軌跡、diff 卡片（重用既有 `StorytellerVersionCompareDialog`，沒有重新設計）、套用/回退都做完並本機端對端驗證過。**明確排除**：手機版專屬排版、多提案 review queue、streaming、聊天歷史重新整理後還原——這些留到之後有需要再排，不影響核心功能完整性。詳細見 [Phase1至7工作項規劃.md](Phase1至7工作項規劃.md) 6.1~6.4。

### Phase 7（排在最後，Claude 打通後再議）：OpenAI／Grok adapter 擴充

- 比照 Phase 3 的做法各自補上 tool-calling adapter，Gemini／OpenRouter／Self-hosted 這三個視實際需求排，不是這輪的必做項目。

## 五、尚待拍板的開放問題

開放問題 2、3、6 已經確認（見上面對應 Phase 的「已定案」段落），以下是還沒拍板、會在對應 Phase 動工前需要決定的：

1. 先做 Claude 一家打通全流程，還是一開始就要求 Claude/OpenAI/Grok 三家平行做？（建議先一家，已反映在 Phase 3/7 的順序上，但還沒正式拍板。）
4. 「套用提案」要新開一個端點，還是直接重用 `storyteller_upsert_story`（Phase 5 動工前拍板）。
5. Agentic 模式要不要用新欄位開關既有 `Agent` 實體，還是設計成新實體（Phase 6 動工前拍板）。

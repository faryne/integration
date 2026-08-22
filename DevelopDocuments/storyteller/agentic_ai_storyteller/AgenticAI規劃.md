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

## 四、需要新增/調整的工具清單

- [ ] `storyteller_revert_story`／`storyteller_revert_lore`（MCP 工具，包一層呼叫既有 `RevertStory`／`RevertLoreVersion` service 方法，前次聊天已定調要做）。
- [ ] Tool registry 抽象層（第 3.3 節），MCP 跟站內 agent runner 共用。
- [ ] `AIProvider` / `AIProviderRequest` / `AIProviderResponse` 擴充 tools/messages 欄位（第 3.2 節）。
- [ ] Claude / OpenAI / Grok 三個 provider 各自的 tool-calling adapter（把統一格式轉譯成各家 API 格式，並把各家回傳的 tool_calls 轉回統一格式）。
- [ ] Agent loop 的 orchestration（呼叫 provider → 收到 tool_calls → 執行 → 把結果餵回去 → 重複，直到 provider 回傳最終文字答案），要決定放在 `service/storyteller` 底下新的檔案，或是獨立成一個 package。
- [ ] 「套用 agent 提案」的 diff 確認端點/流程（第 3.4 節），前端 UX 調整（第 3.6 節）。

## 五、待討論的開放問題（下一步要逐項拍板）

1. 先做 Claude 一家打通全流程，還是一開始就要求 Claude/OpenAI/Grok 三家平行做？（建議先一家。）
2. `AIProvider` interface 走「擴充既有介面」還是「另開 AgenticProvider」（第 3.2 節）？
3. Agent 授權範圍要不要限縮到單一 project，還是沿用「使用者能存取的全部」（第 3.5 節）？
4. 「套用提案」要新開一個端點，還是直接重用 `storyteller_upsert_story`，前端自己組好最終內容再送？
5. 這個 agentic 模式要不要用一個新欄位（例如 `Agent.ToolsEnabled`）在既有 Agent 實體上開關，還是設計成完全獨立的一種新實體？
6. 要不要先在 MCP 那邊補完 revert 工具（範圍小、風險低），當作驗證「tool registry 共用」這個設計方向的第一個實驗，再進入 provider tool-calling 這個大工程？（建議：先做這個，當墊腳石。）

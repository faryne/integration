# SteamLoom Writer AI 助理：長文提案、提案修正、逾時與 MCP 授權

- 狀態：規格已確認；A、B 已實作（2026-10-16），C、D 未開始
- 日期：2026-10-16
- Branch：`writer/ai-assistant-followups`
- 前置文件：`SteamLoom_Writer_AI助理_2026-10-12.md`、`Writer_Proposal_Contract_2026-10-16.md`

## User story

1. 我請 Agent 把整篇故事裡的「梭梭」改成「那頭」，或修幾個段落。Agent 只回傳要改的地方，不必重寫幾萬字全文；review 時一樣看到完整 diff。
2. Agent 的提案格式有錯時，草稿不會消失。Writer 先自動請同一個 Agent 修正一次；還是不行時，我看得到錯誤原因，也能打開原始輸出。
3. 一輪工作超過 10 分鐘時，畫面顯示「等待回應過長」，不會直接砍掉；15 分鐘才強制中斷。這兩個值之後可以在「設定」頁調整。
4. SteamLoom MCP 授權過期時，思考鏈路（任務活動）上直接顯示「SteamLoom 授權已失效」與修復指令，不會讓 Agent 在讀不到作品的情況下憑空回答。

## A. `document.patch` 提案類型

### 格式

```json
{
  "proposal_type": "document.patch",
  "kind": "story",
  "target_id": "<story_public_id>",
  "base_version_id": "123",
  "edits": [
    { "find": "原文片段（要夠長，能唯一定位）", "replace": "新片段" },
    { "find": "梭梭", "replace": "那頭", "all": true }
  ]
}
```

- `title`／`summary` 可省略，省略就沿用目前值。
- `edits` 依序套用在「前一個 edit 套用後」的文字上；最多 200 筆，`find` 不可為空。
- `all` 預設 `false`：`find` 必須剛好出現一次，出現 0 次或多次都算錯誤。`all: true` 時至少要出現一次。

### Writer 端處理

- `prepareProposalItems`：用 REST 讀 base 版本內容，依序套用 edits，算出完整新內容放進 `item.Content`；base snapshot 照現有方式建立。review dialog 沿用現有 diff，不需要改 UI。
- proposal hash 同時涵蓋 `edits` 與算出的 `Content`。
- 套用：與 `document.replace` 走同一條 `saveProposalDocument`（`base_version_id` + `abort_on_conflict`），版本落後就是 `conflict`，不在新版本上重新套用 edits。
- prompt 規則改為：修改既有內容**優先用 `document.patch`**；整章重寫用 `chapter.replace`；只有大半篇都要重寫才用 `document.replace`。

### 影響檔案

- `internal/agent/proposal.go`：新增類型常數、`Edits` 欄位與驗證。
- `internal/agent/proposal_protocol.go`：submission schema 加 `edits`。
- 新檔 `proposal_patch.go`（＋測試）：套用 edits 的純函式，錯誤訊息要指出是第幾筆、出現幾次。
- `proposal_prepare.go`、`proposal_apply.go`：接上 patch。
- `internal/agent/client.go`：`proposalRules()` 文案。
- 前端：`ProposalCard`／`chatEventRegistry` 的套用文案加「修改故事『標題』」；i18n 五個語系。

## B. 提案失敗不丟草稿＋自動修正一次

### 會觸發修正的錯誤

| 類型 | 例子 |
|---|---|
| envelope 解析 | 缺結束標記、JSON 不合法、未知欄位、結束後還有內容、缺可讀摘要 |
| 欄位驗證 | `normalize` 失敗（缺 `target_id`、類型不支援…） |
| 建立基準 | patch 的 `find` 找不到或不唯一、章節 marker 對不上、`base_version_id` 不存在 |

REST 連線失敗、權限錯誤**不**觸發修正，直接失敗（不是 Agent 能修的）。

### 流程

1. 失敗當下先把**原始回答全文**以私有權限存到 `proposals/<thread>/invalid/<task>.txt`，追加 `proposal.invalid` event（錯誤訊息＋檔案相對路徑），可見摘要照常存成 assistant 訊息。
2. 同一個 task 內自動續接同一個 provider session，送出修正 prompt：「上一輪 Writer 提案無法使用：<錯誤>。請依同樣的格式規則只重新輸出修正後的完整 envelope，不要改動內容本身。」任務活動顯示「修正提案格式」。
3. 修正成功：照常進入 `awaiting_confirmation`。
4. 修正後仍失敗：task 轉 `failed`，失敗卡片顯示錯誤原因與「查看原始輸出」按鈕（唯讀 dialog，可全選複製）。不再自動重試，避免燒額度。

### 影響檔案

- `internal/agent/task.go`：`run` 的提案分支加修正迴圈（最多一次）。
- `internal/agent/proposal_store.go`：保存 invalid 原文；刪除 thread 時一起刪。
- `app.go`：新增 `ProposalInvalidOutput` binding 讀原文。
- 前端：失敗卡片加按鈕＋dialog、`chatEventRegistry` 登記 `proposal.invalid`、i18n。

## C. 逾時：10 分鐘提示、15 分鐘中斷

- `client.go` 的 `askTimeout` 改成 `TaskTimeouts{Slow: 10m, Hard: 15m}`，由 `TaskManager` 持有；之後「設定」頁只要改這個值。
- 計時以 task 開始執行（`running`）起算，不含排隊時間；修正提案那一輪（B）共用同一個計時。
- 到 `Slow` 時 `Task` 設 `slow=true` 並 emit `task.slow`。這是即時狀態不落盤：重開 Writer 時執行中的 task 本來就會變成 `interrupted`。
- 到 `Hard` 時取消 context，錯誤訊息「超過 15 分鐘沒有完成，已中斷」；已收到的 partial 照現有方式保存。
- Antigravity 的 `--print-timeout 10m` 必須跟著 `Hard` 調整，否則它會在 10 分鐘自己結束。
- UI：
  - `ActiveTaskStatus` 下方那行文字後面接「· 等待回應過長」（warning 色）。
  - `TaskRail` 的 running chip 改成 warning 色。
  - 實作前先出 mockup 確認。

### 影響檔案

`internal/agent/client.go`、`task.go`、`antigravity.go`、`run.go`（錯誤文案）、前端 `ActiveTaskStatus.tsx`、`TaskRail.tsx`、`useChatLog.ts`、i18n。

## D. MCP 授權失效顯示在思考鏈路

### 各家的訊號（2026-10-16 本機實測）

| Agent | 訊號 | 狀態 |
|---|---|---|
| Claude Code | stream-json 第一個 `system/init` 的 `mcp_servers[]`，對應 server 的 `status` 為 `needs-auth`（`failed` 代表連不上） | 已實測 |
| Codex | **不在 JSONL**；stderr 出現 `rmcp::transport::worker ... AuthRequired(... steamloom.works ...)` | 已實測 |
| Grok Build | 目前設定用 header 帶固定 bearer token，不走 OAuth；token 被撤銷時的輸出待測 | 待實測 |
| Gemini CLI | stream-json `init` 是否帶 MCP 狀態待測 | 待實測 |

### 處理

- 新增共用 `protocolMCPAuthRequired` event（帶「授權失效」或「連線失敗」）。Claude decoder 解析 init；`invoke` 改成逐行讀 stderr，交給 decoder 的 `DecodeStderr`（目前 stderr 只在結束後整包判斷）。
- 偵測到之後**立即中斷這一輪**。理由：prompt 已告訴 Agent 它能讀作品，沒有工具時的回答會是憑空捏造；中斷也能省額度。
- 落盤一筆 task activity（思考鏈路重開後仍看得到），並用現有 `AgentLoginCard` 顯示修復指令：
  - Claude：`claude mcp login <server>`
  - Codex：`codex mcp login <server>`
  - Grok／Gemini：依實測結果補
- Grok／Gemini 的實測放在實作第一步，使用專用測試專案；測不到可靠訊號的 Agent 先不處理，不做猜測式比對。

### 影響檔案

`internal/agent/protocol.go`、`run.go`、`claude.go`、`codex.go`、`task_store.go`（login action 分流成 Agent 登入／MCP 授權）、前端 `TaskActivityCard.tsx`、`agentActivity.ts`、i18n。

## 常見失敗與應對

| 狀況 | 應對 |
|---|---|
| patch 的 `find` 因全形／半形、換行差異對不上 | 走 B 的自動修正，錯誤訊息指出第幾筆；不做模糊比對，避免改錯地方 |
| 修正 prompt 讓 Agent 又改了內容 | review 時以 diff 呈現，作者自己判斷；修正只有一次 |
| 修正那一輪也很慢 | 與原輪共用 15 分鐘上限 |
| 作者把逾時設得比 Agent 實際需要的短 | 設定頁再限制下限（例如 Slow ≥ 3 分、Hard ≥ Slow＋2 分），設定頁做的時候再定 |
| MCP 授權正常，但 Agent 本來就不需要讀作品 | 不受影響，只有偵測到授權失效才中斷 |

## 實作備註（A、B）

- `document.patch` 的 `edits` 只在非空時納入 proposal hash，既有待確認提案的 hash 不變。
- Agent 可修正的錯誤一律包成 `agent.ProposalError`（`internal/agent/proposal_invalid.go`）：envelope 解析、`normalizeProposalItem`、媒體 staging、`prepareProposalItems` 的內容比對，以及 REST 4xx（401／403／429 除外）。
- 自動修正那一輪不另外顯示 progress；任務活動只會多一行「提案無法使用」＋錯誤原因＋「查看原始輸出」。
- 原文存在 `proposals/<thread>/invalid/<event_id>.txt`；刪除 thread 時隨 `proposals/<thread>` 一併刪除，proposal 列表會略過這個目錄（名稱不是 16 位 hex）。
- 前端尚未在 `wails dev` 中實際觸發一次提案失敗驗證畫面。

## 實作順序

1. A（patch）＋B（修正），兩者共用「提案錯誤」的訊息格式，一起做。
2. C（逾時），附 UI mockup。
3. D（MCP 授權），先實測 Grok／Gemini 再決定範圍。

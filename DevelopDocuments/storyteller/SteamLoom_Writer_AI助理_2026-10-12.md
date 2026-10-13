# SteamLoom Writer AI 助理研究與後續規格

- 狀態：mockup 已確認；S1～S5 第一版與專案內容引用已完成
- 日期：2026-10-12
- Branch：`codex/steamloom-writer-ai`
- 現有實作：`apps/steamloom/writer/internal/agent/`、`frontend/src/pages/workspace/ChatPanel.tsx`
- UI 參考：`DevelopDocuments/storyteller/writer-app-mockup/`

## 結論

原本 v0.1.5 只有「偵測本機 CLI、用訂閱帳號問答、續接 session、在本機保存對話」的骨架，三個 adapter 都刻意關閉 tools。S1～S4 第一版已補上多 thread 任務、typed event、串流與 tool trace，並只自動核准 SteamLoom read／validate allowlist；遠端 mutation 仍完全不可用。

AI 助理的產品模型不是「在同一個聊天室切換 provider」，而是**專案層級的多 Agent、多 thread 任務工作台**。同一個專案可以同時讓 Claude 寫第一話、N 個 Codex thread 分別整理角色設定／檢查時間線、Grok Builds 產生圖片；工作互不阻塞，各自保留 thread、provider session、進度、log 與產物。

Writer 的 AI 助理只是發令台。Writer **不連 SteamLoom MCP、不代讀內容、不組 MCP payload**；它只以 project ID 與 tool policy 啟動 Agent CLI，接收 Agent 回傳的串流事件與 proposal，render 預覽／diff 與確認畫面。MCP 連線、OAuth、Skill 執行、內容讀取與確認後的寫回都由 Agent 自己負責。所有 Agent 採兩階段執行：第一階段只能 read／validate 與產生成果；使用者確認後，Writer 才恢復**同一條 Agent thread**並附上限定授權。

建議依序做三階段：

1. **P0 執行層**：task 級 streaming event、獨立停止、三家並行、錯誤分類、CLI readiness。
2. **P1 唯讀 MCP**：讓 Agent 能讀專案、故事、設定與記憶，畫面即時顯示 tool trace；仍不開放任何寫入工具。
3. **P2 proposal／approval**：Agent 將成果交給 Writer 暫存；使用者確認後，恢復同一 thread，由 Agent 自行呼叫核准範圍內的 SteamLoom MCP 寫入工具。

### 實作切片

1. **S1 儲存地基與 thread 刪除**：chat JSONL 向後相容升級為 typed event；實作本機 thread 永久刪除與 production confirm dialog。
2. **S2 TaskManager**：`StartTask` 立即回 task ID、per-thread queue、不同 thread 並行、獨立 cancel、durable task state。
3. **S3 任務工作台 UI**：production 左側 thread／task rail、背景完成 badge、選取狀態不被其他 task 搶走。
4. **S4 streaming 與唯讀 MCP**：Codex app-server、Grok ACP、Claude stream-json；正規化 delta／tool trace，只開 read／validate。
5. **S5 proposal／approval／apply**：共用 diff、圖片 review、一次性 grant、Agent 寫回、conditional write 與重啟查證。

### 目前實作進度

- **S1 已完成**：chat JSONL 向後相容升級為 typed event；Writer 本機 thread 可經 confirm dialog 永久刪除，provider session 與 SteamLoom 資料不受影響。
- **S2 已完成**：`StartTask` 立即回 task ID；同一 thread 依序執行、不同 thread 並行；支援 queued／running task 獨立停止，狀態事件會寫入 thread。
- **S3 已完成第一版**：production AI 助理改為專案層 thread rail，Claude／Codex／Grok thread 混合排序；背景完成不搶選取狀態，重啟後殘留的 running／queued 顯示為 interrupted。執行中的 thread 暫時要求先停止再刪除，自動 cancel-and-delete 留待後續補齊。
- **S4 streaming 已完成第一版**：Claude 改用 `stream-json` partial messages、Grok 改用 `streaming-json`、Codex 沿用 JSONL 並正規化回覆／MCP tool lifecycle；Writer 會即時顯示 partial，停止或失敗時把已收到的內容存成未完成回覆。
- **S4 唯讀工具已完成第一版**：Writer 只解析 Agent 使用者設定中既有的 SteamLoom server 名稱，再把 read／validate allowlist 傳給該 Agent CLI；Writer 不注入 endpoint、不建立 MCP client，也不接觸 MCP 回傳內容。未設定 SteamLoom MCP 時維持純文字模式；Claude 只接受 user-scope 設定，避免誤判只對其他目錄生效的 local-scope server。
- **專案內容引用已完成第一版**：production composer 支援 `@story:[標題]`／`@lore:[標題]` 語法高亮、專案目錄 autocomplete 與已辨識引用 chip；Writer 原樣傳送 token、不讀取或展開本文，由 Agent 透過 SteamLoom MCP 依完整標題定位。`@thisStory`／`@thisLore` 不屬於專案層級 Writer 語法。
- **S5 Step 1 已完成**：新增本機 proposal batch／item／operation 模型；故事與設定更新保存 `base_version_id`、base snapshot 與逐項 SHA-256，圖片會複製到 Writer 管理的 proposal artifact 目錄並保存檔案 hash／大小。payload 先以私有權限落盤，再追加 `proposal.ready` typed event；刪除 thread 時一併刪除 proposal 與圖片。
- **S5 Step 2 已完成**：三家 adapter 共用尾端 proposal envelope；Writer 嚴格解析 schema、拒絕 Agent 自填 id／status／hash，streaming UI 只顯示自然語言摘要、不洩漏 envelope JSON。合法成果會由 TaskManager 落盤並發出 `proposal.ready`，task／thread 轉為可重啟還原的 `awaiting_confirmation`。
- **S5 Step 3 已完成**：production 對話會顯示 proposal card；既有故事／設定以 DB 當下版本與 Agent 提案開啟共用 diff dialog，新內容顯示完整預覽，圖片顯示 Writer 本機暫存資產與檔案 metadata。開啟既有內容時會重新讀取 DB latest，若已偏離 proposal base version 就顯示衝突警告；review 不會寫入編輯歷史。
- **S5 Step 4 已完成**：允許／否決以 per-thread lock 做 compare-and-set，先追加 `proposal.approved`／`proposal.rejected` durable event，再更新 proposal 與 thread index；相同決策可安全重試、相反決策會拒絕。重開 Writer 時由 event log 還原決策，已處理成果不會回到待確認；對話也會保留作者的決策訊息。
- **S5 Step 5 已完成**：故事／設定核准後會排回原 thread queue、恢復同一 provider session，並核發只存在該 apply turn、綁定 proposal hash／project／item／operation 的一次性 grant。三家 CLI 只看得到 proposal 列出的 mutation tool；Agent 必須回傳綁定同一 hash 的 structured apply result，且 Writer 確認核准 tool lifecycle 全部完成後，才持久化 `apply.completed` 與 Agent 的結果訊息。
- **圖片 apply 已完成**：Writer 不直接呼叫 SteamLoom MCP，也不開放 Agent 的 Bash／一般網路權限。圖片 grant 會額外啟動本機 stdio MCP broker；broker 只提供 `writer_upload_approved_asset`，只讀取 proposal 內已核准且 hash 相符的單一檔案，目的地只接受有 AWS SigV4 參數的 HTTPS S3 presigned URL，禁止 redirect 並在該 apply turn 結束後銷毀。Agent 仍自行依序呼叫 SteamLoom presign、窄上傳工具與 confirm asset。
- **S5 Step 6A 已完成**：Writer 對既有故事／設定的核准 operation 強制加入 `abort_on_conflict=true`，並把旗標與 `base_version_id` 一起封進 proposal hash。SteamLoom repository 在同一 transaction 內鎖定 latest version；基準落後時整筆 rollback、不建立新版本，Agent 回報 `apply.conflict`，Writer 將 proposal／thread 持久化為版本衝突。
- **S5 Step 6B 已完成**：重開 Writer 時，只有 `apply.started`、沒有終局 event 的 proposal 會被冪等標成 `verification_required`，對話追加一次 `apply.interrupted` 並撤銷舊 grant；不自動重送 mutation，也不退回等待同意。這是「結果不確定」的安全終局，作者可在原 thread 請 Agent 以唯讀工具查證；建立新內容或圖片若沒有可辨識的回傳 ID，不能假裝能自動判定是否成功。

## 已確認的 user story

> Writer 是專案層級的 Agent 發令台。在同一個專案中，我可以同時命令 Claude 撰寫第一話、N 個 Codex thread 分別處理其他任務、Grok Builds 產生圖片資產。Agent 第一階段只讀取與產生成果，不寫入 DB；任何寫入或刪除都要先由 Writer 顯示成果與影響，使用者確認後才恢復同一 Agent thread，讓 Agent 自行寫回。

這裡的「完成」和「已寫入」必須是不同狀態：

```text
queued → drafting → awaiting_confirmation → approved → applying → applied
                    ├─ rejected                    ├─ conflict
                    └─ failed                      └─ failed
```

- `drafting`：Provider thread 正在讀取／產生內容，可停止；其他 thread（包含同一 provider）不受影響。
- `awaiting_confirmation`：成果只在本機，SteamLoom 尚未改動；使用者可預覽或稍後處理。
- `approved`：使用者核准一組明確的 target、base version、tool scope 與內容 hash。
- `applying`：同一 Agent thread 已恢復，正在自行呼叫核准的 SteamLoom MCP 工具。
- `applied`：SteamLoom 回傳成功；此時才顯示 version ID 或 asset ID。
- `rejected`：使用者放棄這批成果；保留 task log，proposal 暫存檔可清除。

完成通知不能只有一次性的 snack。AI 助理 tab 要有待確認數量、任務清單保留「待確認」狀態；App 不在前景時再補 OS notification，回到 Writer 後仍能開啟相同 review。

| 任務 | proposal | 確認畫面 | 確認後動作 |
|---|---|---|---|
| Claude 撰寫第一話 | 完整故事草稿、標題、摘要 | 新增內容預覽；若覆寫既有故事則顯示與 DB 最新版本的 diff | 恢復 Claude thread，由 Claude 建立故事或新增版本 |
| Codex 整理角色 A | 設定集草稿或 patch、引用來源 | 設定內容與 DB 最新版本的 diff | 恢復 Codex thread，由 Codex 建立／更新設定集 |
| Grok Builds 產圖 | 本機圖片、metadata、建議資產集 | 圖片縮圖、尺寸、格式、名稱、alt | 恢復 Grok thread，由 Grok 取得 presigned URL、上傳並 confirm asset |

三種成果都必須走 confirm dialog。按「稍後確認」只關閉 dialog，不改 task 狀態；按「放棄成果」不碰 SteamLoom，並留下 task 完成紀錄。

### 操作分類

- **不需確認**：所有 list／get／search、讀取記憶、`validate_content`、Agent 推理與產生本機 proposal。
- **一律確認**：建立、更新、移動、還原、上傳、刪除、公開狀態／分級變更，以及任何其他會改變 SteamLoom DB／S3 的工具。
- **確認後執行者**：原本產生 proposal 的同一 Agent thread；Writer 只核發限定 permission。

Confirm Dialog 依成果種類顯示：

- 更新既有故事／設定：確認 dialog 直接以共用 `StorytellerVersionCompareDialog` 顯示 DB 最新版本與 proposal 的完整 diff；不跳轉編輯歷史。
- 新故事／設定：全文預覽、metadata 與建立位置；因 DB 尚無舊版，不製造假的 diff。
- metadata patch／move／visibility：欄位前後值與公開影響。
- 圖片上傳：本機縮圖、尺寸、格式、名稱、alt 與目的資產集。
- 刪除／不可逆資產 replace：目標、引用數與不可回復警告；不能與一般寫入共用模糊的「確認」文案。

## 現況盤點

### 已完成

- `claude`、`codex`、`grok` CLI 偵測，包含桌面 app 常見的精簡 `PATH`。
- 三家 headless 呼叫與 session resume。
- 對話依 `[agent]/[project]/[thread]` 存在使用者設定目錄，畫面一次載入 40 則。
- process group 終止；單輪上限 10 分鐘。
- MCP 設定檔的 SteamLoom URL 檢查與安裝指令。
- 選擇 Agent 時安裝／升級 SteamLoom Skill。
- CLI 在與 repo 分離的工作目錄執行，Codex sandbox 是 `read-only`；三家只允許 SteamLoom read／validate tools，未設定 MCP 時 tools 為空。

### 目前不是什麼

- 不是站內舊 AI 助理的桌面外殼；不使用使用者自備 provider API key。
- 不是 MCP host／proxy；Writer 只 spawn CLI 並限制 tool scope，MCP 連線、OAuth 與內容都留在各家 Agent CLI。
- production 已有 proposal／approval／apply UI 與 durable event；仍未補 OS notification，背景完成先以 task rail 狀態保存。
- Agent 已可自行讀 SteamLoom，並在作者核准後依一次性 grant 更新故事／設定或上傳圖片。Writer 仍不直接存取 MCP。

## 主要缺口

### 1. 唯讀工具已接線，寫入仍須 approval transport

| Agent | 現行限制 | 結果 |
|---|---|---|
| Claude Code | `--tools`／`--allowedTools` 只列 `mcp__<server>__<read tool>`，`dontAsk` | Claude 自行載入既有 MCP 設定；未列出的 mutation 不可執行 |
| Codex | `enabled_tools` 只列 read／validate，sandbox `read-only` | Codex 自行載入既有 MCP 設定；本機與遠端寫入都不在本輪範圍 |
| Grok Build | `dontAsk` + 精確 `MCPTool(<server>__<read tool>)` allow rules | Grok 自行載入既有 MCP 設定；未列出的 mutation fail closed |

`AssistantSetup` 仍需再補登入／OAuth readiness；目前 URL 設定存在只代表 Agent 有機會連線，不保證憑證仍有效。
Grok 的 `max-turns` 從 2 提高到 12，讓它能連續讀取故事、設定與記憶；Writer 的 10 分鐘 task timeout 仍是硬上限。

### 2. 一次性 subprocess 不足以承接並行任務 UI

現行 `Ask()` 只回 `{session_id, text}`，前端也只有一個全域 `sending` 狀態。雖然既有儲存層已經有 `[agent]/[project]/[thread]`，UI 仍會因任一請求執行中而鎖住 Agent 與 thread 選單。production UI 必須以 task ID 隔離每一個 Agent run，至少需要以下事件：

現有 thread 儲存可以沿用，但要拆掉三個隱含的單工假設：

- `ChatPanel.sending` 改成 `tasks[task_id].state`；composer 送出後立即可切換或建立其他 thread。
- `SaveTurn` 完成時不能把全域 `current_id` 切到「最後完成的 thread」；目前選取哪條 thread 是 UI 狀態，背景 task 完成只能更新該 thread 的 unread／status。
- 同一 thread 的兩輪不能同時讀到相同 `session_id` 再各自 resume；`TaskManager` 必須做 per-thread queue，不同 thread 則完全並行。

- `task.started`：task ID、Agent、project、provider session。
- `assistant.delta`：逐段回答。
- `tool.started`／`tool.completed`：工具名稱、目標摘要、成功／失敗；敏感 arguments 不直接灑到畫面。
- `proposal.ready`：產物種類、預覽資料、本機位置、建議操作、目標與 `base_version_id`。
- `task.completed`／`task.failed`／`task.canceled`。
- `approval.granted`／`approval.expired`：使用者核准的操作範圍與失效原因。
- `apply.started`／`apply.completed`／`apply.failed`：同一 Agent thread 確認後的 SteamLoom 寫入結果。
- `content.changed`：專案、故事／設定 ID、新 version ID、asset ID、`version_conflict`。

Wails 端適合把 `Ask` 拆成 `StartTask`（立即回 task ID）、`CancelTask`、`ReviewProposal`、`ApproveProposal`、`RejectProposal`、`DeleteThread`，事件走 `runtime.EventsEmit`；不要讓前端 HTTP-poll Go binding。

### 3. 三家不能只靠完全相同的 CLI flags 抽象

- **Codex**：正式 `app-server` 是 JSON-RPC/JSONL，提供 thread start/resume、streaming item、MCP tool item、interrupt 與 server-initiated approval，最適合當正式 adapter。`codex exec --json` 可保留為相容 fallback。
- **Grok Build**：`grok agent stdio` 提供 ACP/JSON-RPC，`session/update` 會送 agent message chunk；比每輪 `grok -p` 更適合長駐。`grok -p --output-format streaming-json` 可作 fallback。
- **Claude Code**：短期可用 `-p --output-format stream-json --include-partial-messages`；要把 permission request 真正接到 Writer，需改用 Agent SDK 的 `canUseTool` 類 host callback，單靠 `-p` 的 `dontAsk` 無法讓 Writer 中途詢問使用者。

對外仍維持同一個 Go `Client` 介面，但內部要允許 `app-server`／ACP／stream-json 三種 transport，不要強迫三家都走「執行一次命令後 parse 最後 JSON」。

### 4. 確認後仍由 Agent 寫回

Writer 不自行組 API payload，也不代替 Agent 寫入 DB；否則 Writer 會從發令台變成第四個執行者，還得重做 Skill 已經定義的 marker、format validation、版本與寫入後驗證。

正式流程是 proposal + scoped approval：

- Draft turn 只允許 SteamLoom read-only／validate 工具，以及不碰 DB 的本機 `writer_submit_proposal`。
- Agent 用 `writer_submit_proposal` 交付完整內容、建議 tool、target、`base_version_id` 與本機圖片路徑；這不是遠端寫入。
- Writer 用 DB 當下的最新內容建立預覽或 diff，並保存 proposal content hash。
- 使用者確認後建立一次性的 `ApprovalGrant`，再恢復同一 Agent thread；Agent 自行呼叫 SteamLoom MCP。
- Adapter 的 permission callback 只自動放行與 grant 相符的 tool、target、base version 與 content hash；其他寫入照樣拒絕並重新要求確認。
- grant 成功使用一次、超時、內容改變或版本改變後立即失效，不能變成「本輪全部允許」。

SteamLoom MCP 的標準 annotations 仍值得補齊，供其他 MCP client 正確判斷工具風險：

- `readOnlyHint`：`get_*`、`list_*`、project search、memory search、validate。
- `destructiveHint`：刪除、整份覆寫、章節 replace／delete、revert、資產 replace；寧可保守標記。
- `openWorldHint: true`：所有工具都會碰遠端 SteamLoom 狀態。
- Claude 對必須由真人確認的工具，可再評估 `_meta["anthropic/requiresUserInteraction"]`；這會讓 `-p` headless 無法自動核准，因此要和 Agent SDK adapter 同期上線。

各 adapter 必須把 provider 的 permission protocol 正規化成同一個 `ApprovalBroker`：Codex app-server 承接 server request、Claude Agent SDK 使用 `canUseTool`、Grok ACP 承接 permission request。Prompt／Skill 負責告訴 Agent 先提案，Broker 才是最後一道強制邊界。

### 5. 確認寫回前後都要處理編輯衝突

Agent 產生 proposal 時保存目標文件的 `base_version_id`；使用者開啟確認畫面時，由 Writer 只讀 API 重新取得 DB latest version，diff 永遠以這個版本為左側：

1. DB latest 與 proposal base 不同時，舊 proposal 不能直接確認；恢復 Agent thread，要求依最新版本重新產生 proposal。
2. 使用者確認時，grant 綁定 review 當下的 version ID 與 proposal content hash。
3. Agent 真正呼叫寫入工具前，SteamLoom 必須做 conditional write；version 已變動就拒絕且不建立新版本。
4. 寫入成功後 Writer 重新抓該文件與 versions；編輯器沒有未存變更時直接載入新版本。
5. 有未存變更時顯示既有 mockup 的衝突 banner，讓使用者選「保留我的修改」或「載入新版本」。
6. 寫入前的 proposal review 直接沿用共用 diff 元件，但不列入編輯歷史；寫入成功後，實際產生的新版本才會出現在編輯歷史，task result 此時才提供歷史「比對」與「還原」。

現行 `storyteller_upsert_story`／`storyteller_upsert_lore` 在 `base_version_id` 過期時仍會先寫入，只回傳 `version_conflict: true`；這不符合此確認模型。SteamLoom MCP 要補 `abort_on_conflict`（或等價 conditional-write API），確認流程一律使用 fail-before-write 模式。

## 建議架構

```text
React ProjectAssistant
  ├─ TaskList（Claude / Codex / Grok Builds 可同時執行）
  ├─ TaskThread + ProposalReview + Diff
  ├─ StartTask / CancelTask / ApproveProposal / RejectProposal / DeleteThread
  └─ Wails events（task / delta / tool / proposal / approval / apply / content changed）
            │
Go AgentTaskManager（每個 thread 至多一個 active task；不同 thread 可並行）
  ├─ Codex app-server adapter
  ├─ Grok ACP adapter
  └─ Claude stream-json adapter → Agent SDK adapter
            │
ApprovalBroker（一次性 grant：tool + target + base version + content hash）
            │
本機 CLI 已登入的訂閱帳號
            │
SteamLoom Skill + MCP
  ├─ 確認前：read / validate + writer_submit_proposal
  └─ 確認後：同一 Agent thread 取得限定 write permission
            │
steamloom.works/mcp → conditional write／版本／稽核
```

### Writer 的責任邊界

Writer 負責啟動／恢復／停止 thread、彙整串流事件、保存本機對話、顯示 proposal／diff、取得使用者確認與核發限定 permission。Writer 不產生內容、不選擇 MCP write tool，也不自行送出 DB payload。

Writer 不會呼叫 MCP tool，也不會把故事／設定內容讀出後轉送 provider。它傳給 Agent 的只有任務指令、專案識別與這輪允許的 tool 名稱；所有 MCP request／response 只存在 Agent 與 SteamLoom 之間。Writer 收到的是 adapter 正規化後的進度、tool lifecycle、回答與 proposal。

AI 助理位於專案層級，不保留 `@thisStory`／`@thisLore` 這類依賴「目前文件」的隱性狀態。明確引用只支援 `@story:[標題]` 與 `@lore:[標題]`；Writer 提供語法高亮與標題 autocomplete，但不展開內容，Agent 再依 token 自行透過 MCP 讀取。沒有引用時，由 Agent 按 Skill 與任務判斷需要讀取的脈絡。

Agent 仍按照 SteamLoom Skill 決定讀哪些記憶／前文、如何保留 marker、要用 chapter replace 還是 upsert、以及寫入後如何驗證。Writer 的 `ApprovalBroker` 只回答「這個具副作用的 tool call 是否與使用者剛才核准的內容完全相符」。

### 任務與產物資料模型

```go
type AgentTask struct {
    ID, ThreadID, ProjectID, Agent, Prompt string
    State, CreatedAt, StartedAt, FinishedAt string
    Proposal                               *Proposal
}

type AgentThread struct {
    ID, ProjectID, Agent, ProviderSessionID string
    Title, UpdatedAt                        string
}

type Proposal struct {
    ID, Kind, LocalPath, Tool, TargetID, BaseVersionID string
    Title, Summary, ContentType, MIMEType, ContentHash string
    Preview                                          ProposalPreview
}

type ApprovalGrant struct {
    ID, TaskID, ThreadID, Tool, TargetID, BaseVersionID, ContentHash string
    ExpiresAt, ConsumedAt                                             string
}
```

- thread 是長期對話／provider session；task 是 thread 裡的一輪執行。相同 thread 的 task 必須依序執行，避免兩輪同時 resume 同一個 provider session。
- 不同 thread 即使 Agent 都是 Codex 也可以同時執行；不能以 `agent_id`、`project_id` 或共用 `sending` boolean 當互斥 key。
- task 狀態與 metadata 寫入使用者設定目錄；重開 Writer 後，`awaiting_confirmation` 任務仍在待確認清單。
- 同意／否決不是暫態 UI flag；必須先追加成 thread 的 typed event，再更新 task index。重開 Writer 時由 event log 還原決策，不能把已處理的 proposal 重新顯示成 `awaiting_confirmation`。
- 文字與設定 proposal 保存完整內容及 diff 所需的 base snapshot。
- 圖片保存本機檔案、MIME、尺寸、檔案大小、建議名稱／alt／資產集；確認前不取得 presigned URL，避免 URL 過期。
- proposal 必須有專案 ID，不能在 review dialog 改套用到其他專案。
- 同一 task 可交付多項 proposal item，預設整批確認；grant 仍逐項綁定 hash，避免 Agent 寫入 review 外的內容。

### 決策紀錄與重啟恢復

現行 chat JSONL 只有 `{role, text}`，只能保存一般問答；P0 要升級成 append-only typed event log。至少包含 `message.user`、`message.agent`、`proposal.ready`、`proposal.approved`、`proposal.rejected`、`apply.started`、`apply.completed`、`apply.failed` 與 `apply.conflict`。事件需保存 `event_id`、`thread_id`、`task_id`、`proposal_id`、時間、操作者，以及 proposal content hash／target 等可稽核摘要。

- 使用者按「允許」或「放棄」時，後端在 per-thread lock 裡以 compare-and-set 驗證 proposal 仍是 `awaiting_confirmation`，**先持久化 decision event，成功後才關 dialog／改畫面**；重複點擊不會建立第二次決策。
- 對話時間線顯示人類可讀的系統事件，例如「你已允許 Claude 將提案寫入〈第一話〉」或「你已否決這批圖片，未上傳 SteamLoom」，但狀態不能靠文案解析。
- 同意後不能只顯示 snackbar：原 thread 立即追加 decision event，接著串流 Agent 的 tool trace，最後由 Agent 在同一 thread 回覆寫入成功、失敗或衝突，以及 version ID／asset ID。task 在最終事件前保持 `applying`，不能按下同意就直接標成 `applied`。
- 否決後也以 thread 內的 decision event 作為主要回饋，task 轉為 `rejected` 並結束；一般情況不另外顯示 snackbar。
- Snackbar 只用於使用者正在看其他 thread 時的背景完成／失敗提醒，或無法附著到某條 thread 的 App 級錯誤；它不是狀態來源，也不能取代對話內結果。
- `task index`／未讀 badge 是 event log 的衍生 snapshot；啟動時若 snapshot 遺失或落後，以 event log 重建。因此已否決仍是 `rejected`，已寫入仍是 `applied`，不會退回待確認。
- 「稍後確認」沒有產生 decision event，proposal 才會繼續保持 `awaiting_confirmation`。
- 若 Writer 在同意後、寫入結果落盤前中斷，重開後追加 `apply.interrupted` 並標成 `verification_required`／「寫入結果待查證」；不能自動重送 mutation，也不能假裝尚未同意。既有故事／設定可在原 thread 以 target、base version 與內容查證；建立新內容或圖片若中斷前沒有保存回傳 ID，維持不確定狀態，由作者決定後續處理。
- proposal／decision／apply result 都留在該 Writer thread；刪除 thread 時才隨本機紀錄一併永久刪除。

### Thread 刪除語意

Writer thread 與 provider session 是兩份不同資料，不能把一個「刪除」按鈕當成相同能力：

1. **Writer 本機 thread**：使用者確認後永久刪除 Writer 的 JSONL、task metadata、未使用 grant 與 proposal／圖片暫存檔，並從 index 移除。這不碰 SteamLoom DB。
2. **Provider session**：第一版只解除 `ProviderSessionID` 關聯，不主動刪除；各家能力與副作用不同，之後再做 capability-based 選項。

若 thread 還在執行，刪除流程先 cancel、等 child process／turn 確認結束，再刪本機檔案；不能讓已刪 thread 的背景 Agent 繼續產生或寫入。待確認 proposal 隨 thread 一起刪除，所有 grant 立即失效。

| Provider | 已確認能力 | 風險／第一版決定 |
|---|---|---|
| Codex app-server | `thread/delete` 可永久刪 persisted thread，且會連 spawned descendants 一起刪 | 副作用大；第一版不跟 Writer thread 自動連動 |
| Grok Builds | CLI 有 `grok sessions delete` | 可做 adapter capability，但第一版預設不呼叫 |
| Claude Code | 官方 CLI 文件有 resume／rename，未文件化可供 Writer 非互動呼叫的 session delete API | 第一版只刪 Writer 本機紀錄 |

建議之後若加入「同時刪除 Agent session」，放在刪除確認 dialog 的次要 checkbox，只有 adapter 回報 `CanDeleteProviderThread` 時才出現，預設不勾選；Codex 必須額外提示可能連 descendant threads 一起刪除。

## 分期工作項

### P0：可觀察、可停止的並行任務

- 新增 `TaskManager`，每個 task 有 ID、context cancel、狀態；互斥範圍只到 thread，不設 project 或 provider 全域鎖。
- 同一 provider 可同時啟動 N 個不同 thread；若需要保護 CPU／記憶體，只設可調整的全域 worker 上限並排隊，不能改變 thread 的邏輯模型。
- 同一 thread 收到第二個 prompt 時先排在該 thread 後面，不能並行 resume 同一個 provider session。
- 沿用既有 `[agent]/[project]/[thread]` 對話路徑；durable message／proposal／decision／apply event 寫入 typed JSONL，task index 與 proposal payload 另存。`assistant.delta` 等可重建的暫態串流不逐 token 落盤，完成或中斷時再合併成 event。
- 背景 thread 完成時只更新該卡片的狀態與未讀 badge，不搶走使用者目前選取的 thread。
- Codex 改 `app-server`；Grok 改 ACP；Claude 先改 `stream-json`。
- 前端左側顯示專案 thread／任務清單，右側顯示選取 thread 的對話、逐段回答與獨立停止按鈕；不能再用一個 `sending` 鎖住整個 `ChatPanel`。
- CLI 不存在、未登入、版本不支援、session 找不到、額度用盡、網路失敗分開顯示。
- 取消後保留已收到的文字，但標成「已停止」，不把半段輸出當完整 assistant turn。
- transport 與生命週期穩定後，只開 read／validate allowlist；任何 mutation 繼續 fail closed。

### P1：唯讀 SteamLoom

- Agent readiness 回傳 `cli`／`login`／`mcp_config`／`mcp_auth`／`skill` 五個狀態，不再只掃設定檔 URL。
- prompt 固定帶 `project_public_id`；從文件入口開 AI 時再帶 kind／document ID。
- 只暴露唯讀工具；Writer 顯示讀取軌跡。
- MCP 未授權時在原畫面完成 OAuth 或給明確修復指令，不送出一輪注定失敗的 prompt。
- 成功標準：問「第三章的衝突是否符合角色設定」時，Agent 真的讀故事、角色設定與記憶後回答。

### P2：proposal、確認與 Agent 寫回

- Adapter 第一階段只允許 read／validate 與本機 `writer_submit_proposal`，所有遠端 mutation 預設拒絕。
- Claude／Codex 的文字成果顯示與 DB 最新版本的 diff；Grok Builds 顯示圖片縮圖、尺寸、檔案大小與資產 metadata。
- task 完成時先把 Agent 最終結果與 apply event 寫進原 thread；使用者正在看別條 thread 時才補站內提醒，App 不在前景時再發 OS notification。
- confirm dialog 明確顯示「尚未上傳／寫入」；確認後建立一次性 grant 並恢復同一 Agent thread。
- Agent 自行呼叫獲准的 SteamLoom MCP 工具；permission callback 驗證 tool、target、base version 與 content hash。
- SteamLoom 補 conditional write，版本變動時 fail before write 並讓 proposal 回到待重新產生狀態。
- 寫入成功後顯示版本號／asset ID、比對／還原，並刷新 workspace/document/history/assets。
- 保留 Skill 的語意：使用者只是在糾文筆或提供樣本時不能自動 upsert；只有明確要求更新才寫。
- `base_version_id` 過期與 `version_conflict` 不吞掉，立即顯示編輯衝突處理。

## UI 決定點

`writer-app-mockup` 改成專案層級 AI 工作台：左側 thread／task list 同時顯示三家狀態，右側仍是單一 thread 的對話與 tool trace；待確認 task 顯示「檢視成果」，confirm dialog 的主動詞是「允許 Agent 上傳／寫入」，不是 Writer 自行套用。

第一版沿用全頁 tab，不做右側 dock。這不是因為只能跑一個對話，而是 full-page 才有空間同時呈現 task list、selected task thread 與 proposal review；文件編輯頁只需顯示完成 badge／衝突 banner。

文字 proposal 的確認畫面不導向「編輯歷史」。production 直接沿用網站已有的 `StorytellerVersionCompareDialog`／`CustomDiffSection`；左側標為「目前版本（DB #N）」、右側標為「Agent 提案（尚未寫入）」，並讓 dialog 接受 proposal 專用標題與確認 actions。現有 `StorytellerAgenticProposalCard` 已用同一元件比對 current story 與 AI proposal，可沿用這個 precedent，不另造一套 diff renderer。

## 本輪實作

- Grok headless invocation 加上 `--no-auto-update`。官方文件明確建議 scripts／ACP 使用，避免 Writer 問答期間背景更新 CLI。
- 三家 adapter 改成串流輸出並正規化回答 delta／tool lifecycle；取消或失敗時保存 partial reply。
- 新增 SteamLoom read／validate allowlist 與 server 名稱解析；Writer 只傳 tool policy，Agent CLI 自行處理既有 MCP 設定、OAuth 與內容。
- 新增三家 adapter 參數測試，確認 allowlist 不含 `upsert` 等 mutation；沒有 MCP 設定時仍維持無 tools。

## 驗證

- Go：`go test ./internal/agent`。
- 三家 transport parser 用 fixture 測試，不在 unit test 真的消耗使用者訂閱。
- P0 完成後各家至少人工驗證：新 thread、resume、stop、CLI crash、session 不存在、app 關閉時 child process 清除。
- P1/P2 用專用測試專案驗證 MCP；不能對正式作品跑破壞性測試。
- Windows 要特別驗證 npm `.cmd` wrapper、process tree cancel、Unicode config path。

## 官方資料

- Codex non-interactive mode：https://learn.chatgpt.com/docs/non-interactive-mode
- Codex app-server：https://learn.chatgpt.com/docs/app-server
- Codex MCP：https://learn.chatgpt.com/docs/extend/mcp
- Claude Code CLI：https://code.claude.com/docs/en/cli-usage
- Claude Code commands：https://code.claude.com/docs/en/commands
- Claude Code MCP：https://code.claude.com/docs/en/mcp
- Grok Build headless／ACP：https://docs.x.ai/build/cli/headless-scripting
- Grok Build CLI reference：https://docs.x.ai/build/cli/reference
- Grok Build MCP：https://docs.x.ai/build/features/mcp-servers

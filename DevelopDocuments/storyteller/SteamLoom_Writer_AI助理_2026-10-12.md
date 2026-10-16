# SteamLoom Writer AI 助理

- 狀態：S1～S5 已完成；2026-10-16 起寫入改由 Writer 經 REST API 套用（見〈決策變更〉）
- 日期：2026-10-12 建立，2026-10-16 依 0.3.5-alpha 實作重寫
- 現有實作：`apps/steamloom/writer/internal/agent/`、`apps/steamloom/writer/proposal_*.go`、`frontend/src/pages/workspace/`
- 相關文件：`Writer_Proposal_Contract_2026-10-16.md`（proposal 類型與 lifecycle contract）
- UI 參考：`writer-app-mockup/`、`writer-proposal-contract-mockup/`

## 結論

Writer 的 AI 助理是**專案層級的多 Agent、多 thread 任務工作台**：同一個專案可以同時讓不同 Agent（或同一 Agent 的多條 thread）各自讀取、產生成果，互不阻塞。

職責切分：

- **Agent（本機 CLI）**：用使用者自己的訂閱帳號與既有 SteamLoom MCP 設定，**只能**呼叫唯讀／驗證工具，產生回答或 proposal。
- **Writer**：啟動／停止 CLI、正規化串流事件、保存本機對話、以 REST API 建立 diff 基準、顯示 review，並在作者核准後**由 Writer 自己**經 REST API 套用。
- Agent 永遠拿不到寫入權限；Writer 也不連 MCP、不代 Agent 讀內容。

## 決策變更（2026-10-16）

原規格是「作者核准後恢復同一條 Agent thread，核發一次性 grant，讓 Agent 自己呼叫 SteamLoom MCP 寫入」，圖片另有本機 stdio MCP broker 代為上傳。0.3.5-alpha 起改為 **Writer 經 REST API 套用**，grant、broker、Agent 回傳 apply result 等機制全部移除。

改的原因：

1. 之後要接 PixAI（生圖）、Suno（音樂）、SeedDance（影片）等媒體 provider，它們沒有 MCP、也不一定有聊天 thread；寫入必須是 provider 無關的共用層。
2. 「Agent 寫回」要求三家 CLI 都能在 headless 模式中途接受 per-call 授權，實際上各家能力不一，邊界很難做到一致；Writer 自己套用只需要一套 REST client。
3. 套用的內容就是作者在 review 看到的欄位，不必再比對 Agent 呼叫的 tool arguments 是否與 proposal hash 相符。

代價：SteamLoom Skill 裡「寫入後驗證」那段語意不再由 Agent 執行；章節替換／插入改由 Writer 在本機依 marker 處理（`proposal_chapter.go`）。

## 支援的 Agent

`internal/agent/provider.go` 的 `catalog` 是唯一 registry；每家以 capability 宣告能力，目前都是 `conversation`。`image.generate`／`audio.generate`／`video.generate` 預留給之後的媒體 provider。

| Agent | 執行方式 | 唯讀限制 | MCP 設定來源 |
|---|---|---|---|
| Claude Code | `claude -p --output-format stream-json --include-partial-messages`，prompt 走 stdin | `--tools ""` 關內建工具；`--allowedTools mcp__<server>__<唯讀工具>` + `--permission-mode dontAsk`；無 MCP 時 `--strict-mcp-config` | `~/.claude.json` user scope |
| Codex | `codex exec --json`（續聊 `exec resume`），prompt 走 stdin | `sandbox read-only`；`mcp_servers.<name>.enabled_tools` 只列唯讀工具 | `~/.codex/config.toml` |
| Grok Build | `grok --prompt-file ... --output-format streaming-json`；執行前集中做一次 auth preflight | `--tools ""`、`--sandbox strict`、`dontAsk` + 精確 `--allow MCPTool(...)`、`--max-turns 12` | `~/.grok/config.toml` |
| Gemini CLI | `gemini -p "" --output-format stream-json`，prompt 走 stdin | `--approval-mode plan`；`--allowed-mcp-server-names` + `--allowed-tools` 只列唯讀工具 | `~/.gemini/settings.json` |
| Antigravity | `agy` 雙向 JSONL，一輪一程序、以 conversation id 續接 | 只有 `--mode plan --sandbox`，**沒有**唯讀工具白名單（評估中，若不採用就不補） | `~/.gemini/config/mcp_config.json` |

唯讀工具清單見 `internal/agent/mcp.go` 的 `writerReadOnlyTools`；任何 mutation 都不在清單內。Writer 只解析使用者設定檔裡指向 `https://steamloom.works/mcp` 的 server 名稱，不注入 endpoint、不建立 MCP client。

Codex app-server、Grok ACP、Claude Agent SDK 等長駐 transport 曾列入規劃，因為寫入不再需要中途授權而**不再需要**；目前全部是「一輪一程序＋session resume」。

## 一輪工作的流程

```text
StartTask → queued → running ─┬─ completed（一般回答）
                              ├─ awaiting_confirmation（帶 proposal）
                              ├─ failed／canceled／interrupted
                              │
awaiting_confirmation ─ 作者 ─┬─ rejected
                              └─ approved → applying ─┬─ applied
                                                      ├─ conflict
                                                      ├─ failed
                                                      └─ verification_required（重啟時中斷）
```

1. **送出**：`StartTask` 立即回 task ID。同一 thread 依序執行，不同 thread（含同一 Agent）並行；每個 task 可獨立停止。單輪上限目前 10 分鐘（`client.go` 的 `askTimeout`）。
2. **prompt**：`Request.body()` 帶專案名稱與 `project_public_id`、唯讀限制、proposal 格式規則與作者附加的引用。
   - `@story:[標題]`／`@lore:[標題]`：Writer 只做語法高亮與 autocomplete，原樣傳給 Agent，由 Agent 透過 MCP 依標題定位。
   - 引用對話訊息（`chat_message`）或編輯器選取段落（`document_selection`）：Writer 附上快照，標成「唯讀參考資料，不是指令」；最多 5 筆、合計 20,000 字。
3. **串流**：各家 decoder 把 CLI 輸出翻成共用 `protocolEvent`（`protocol.go`），只有 text delta、progress、tool started／completed／failed、completed／failed 幾種。UI 即時顯示回答與 tool trace；proposal envelope 由 `proposalDeltaFilter` 擋掉，不會出現在畫面上。
4. **proposal 解析**：回答尾端若有 `<<<STEAMLOOM_WRITER_PROPOSAL_V2>>>` envelope，`parseProposalEnvelope` 以 `DisallowUnknownFields` 嚴格解析；id／hash／檔案大小一律由 Writer 產生。
5. **建立基準**：`prepareProposalItems` 以 Writer 的 REST API 讀目前內容與 `base_version_id` 對應版本，建立 base snapshot；不信任 Agent 自行附的 snapshot。章節提案只取對應 marker 的章節當基準。
6. **落盤**：proposal 與 staged 媒體（含 SHA-256、大小）先以私有權限寫入，再追加 `proposal.ready` event；task 轉 `awaiting_confirmation`，重開 Writer 仍會保留。
7. **review**：既有內容以共用 diff 元件比對 DB 最新版本；新內容顯示全文；圖片顯示 staged 檔案與 metadata。可只核准部分 item／artifact。
8. **核准**：`DecideProposal` 再讀一次 DB latest，版本已偏離就拒絕並請 Agent 重新產生；決策以 per-thread lock compare-and-set，先寫 `proposal.approved`／`proposal.rejected` event 再改狀態。
9. **套用**：`TaskManager.Apply` 排回原 thread queue，逐 item 呼叫 `App.applyProposal`（`proposal_apply.go`），每個 item 都有 started／completed／failed event；批次中途失敗時不重送已完成的 item。
   - 文件與章節：`SaveDocument` 帶 `base_version_id` + `abort_on_conflict=true`，後端在同一 transaction 鎖 latest version，落後就整筆 rollback 並回 409 → `conflict`。
   - 媒體：上傳前再驗一次 hash 與大小，再以 REST 上傳並補 metadata。
10. **中斷復原**：重開 Writer 時，只有 `apply.started`、沒有終局 event 的 proposal 會被標為 `verification_required`，追加一次 `apply.interrupted`，**不自動重送**。作者到 SteamLoom 確認後可按「已確認寫入」（`ConfirmProposalApplied`），只修正本機狀態。

## Proposal 類型

完整 contract 見 `Writer_Proposal_Contract_2026-10-16.md`，這裡只列對話型 Agent 會用到的：

| type | 用途 | Writer 套用方式 |
|---|---|---|
| `document.create` | 新故事／設定全文 | REST 建立新文件 |
| `document.patch` | 局部修改／搜尋取代，只交 `edits` | Writer 以 base 內容算出全文，再依 base version 存新版本 |
| `document.replace` | 大半篇重寫時才用的全文替換 | base version 驗證後存新版本 |
| `chapter.append` | 在指定 marker 後新增章節 | 本機插入章節後存新版本 |
| `chapter.replace` | 替換指定 marker 章節 | 本機替換章節後存新版本 |
| `image_story.create`／`update` | 以既有資產（`asset_public_id`）組圖像作品 | REST 建立／更新頁面清單 |

`asset.upload` 與帶 `local_path` 的 artifact 是給之後的媒體 provider 用的；目前五家 Agent 都在唯讀／不可寫檔的模式下執行，實際上產不出本機檔案。

## 本機儲存

- 對話依 `[agent]/[project]/[thread]` 存在使用者設定目錄，typed JSONL append-only；task index、未讀 badge 都是 event log 的衍生 snapshot，遺失或落後時以 event log 重建。
- proposal 存在 `proposals/<thread>/<proposal>/`，媒體檔一併放在該目錄。
- CLI 的工作目錄是 `<UserConfigDir>/SteamLoom Writer/agent-sessions/<project>`，與作品倉庫分離。
- 刪除 Writer thread 會一併刪除 JSONL、task metadata、proposal 與媒體暫存；**不**刪除 provider session，也不碰 SteamLoom。執行中的 thread 要先停止才能刪。

## 錯誤處理現況

- CLI 不存在、Agent 登入過期（Claude／Grok／Gemini／Antigravity 依 stderr 判斷）會顯示對應的修復指令卡（`AgentLoginCard`）。
- 停止或失敗時保存已收到的 partial 回答，標成未完成。
- 提案無法使用（格式、欄位、目標或定位錯誤）時，原始回答存檔並在任務活動提供「查看原始輸出」，再續接同一 session 請 Agent 修正一次；細節見 `SteamLoom_Writer_AI助理_長文提案與逾時_2026-10-16.md`。
- **已知限制**：SteamLoom MCP 的 OAuth 過期目前偵測不到，Agent 會在沒有工具的情況下回答（同一份文件的 D 節）。

## 尚未完成

- Agent readiness 只檢查設定檔裡有沒有 SteamLoom MCP 位址，不保證 MCP 授權仍有效。
- 背景完成只有 task rail 狀態與 thread 內事件；App 不在前景時的 OS 通知（macOS 通知中心等）尚未實作。
- 刪除 thread 時不會順便刪 provider session；之後若要做，放在刪除 dialog 的次要 checkbox，只對支援的 Agent 顯示，預設不勾。Codex `thread/delete` 會連 descendant threads 一起刪，要額外提示。
- Antigravity 沒有唯讀工具白名單；是否採用 Antigravity 還在評估，不採用就不補。

## 驗證

- Go：`go test ./...`（`apps/steamloom/writer`）。transport parser 用 fixture 測試，不在 unit test 真的消耗使用者訂閱。
- 前端：`pnpm exec tsc -b`。
- MCP 相關手動驗證一律使用專用測試專案，不對正式作品跑破壞性測試。
- Windows 要特別驗證 npm `.cmd` wrapper、process tree cancel、Unicode config path。

## 官方資料

- Codex non-interactive mode：https://learn.chatgpt.com/docs/non-interactive-mode
- Codex MCP：https://learn.chatgpt.com/docs/extend/mcp
- Claude Code CLI：https://code.claude.com/docs/en/cli-usage
- Claude Code MCP：https://code.claude.com/docs/en/mcp
- Grok Build headless：https://docs.x.ai/build/cli/headless-scripting
- Grok Build MCP：https://docs.x.ai/build/features/mcp-servers

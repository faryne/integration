# Codex UI/UX 設計提案：Agentic AI Storyteller

日期：2026-08-22

這份提案只討論前端 UI/UX，不涉及程式碼實作。目標是把既有故事/設定集編輯頁的「單輪 AI Agent 聊天面板」，升級成可以顯示工具呼叫過程、承接寫入提案、讓使用者看 diff 後確認套用，並保留清楚回退入口的 agentic 工作流。

## 已確認的既有脈絡

### Repo 內前端慣例

- 既有 AI Agent 面板是 `StorytellerAgentPanel.tsx`：放在 `Paper variant="outlined"` 裡，桌面 `lg` 斷點 sticky，高度約 720；訊息區 `xs` 最小高度 360、最大高度 520，`lg` 最大高度 480。
- 故事編輯頁用 `Grid` 切欄：沒有側欄時編輯器 `xs:12 / lg:12`，開 AI 或歷史側欄時為 `xs:12 / lg:7` + 側欄 `xs:12 / lg:5`。也就是手機版目前不是左右分欄，而是上下堆疊。
- AI / 編輯歷史切換用 `StorytellerEditorSideTabs.tsx` 的 `ToggleButtonGroup`，目前只有 `ai` 與 `history` 兩個 panel。
- 版本比對已有 `StorytellerVersionCompareDialog.tsx`，使用 `useMediaQuery(theme.breakpoints.down("sm"))` 在小螢幕轉 `fullScreen`，內部使用 `CustomDiffSection.tsx`。
- `CustomDiffSection.tsx` 已支援 `gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }`：手機直向堆疊，桌面左右對照。
- diff 前會透過 `stripMarkerForDiffContent()` 移除 WYSIWYG 內部 marker，避免使用者看到 `⟦uuid⟧` 之類的內部語法；AAS 提案 diff 必須沿用這條規則。
- 成功/失敗回饋慣例是 `CustomSnackbar.tsx`：右下角、`autoHideDuration` 預設 2500ms。錯誤也常搭配 inline `Alert`，例如存檔衝突提示會放在編輯器 sticky header。
- 工作台手機版用 `useMediaQuery(theme.breakpoints.down("md"))` 切換：`ProjectWorkspacePreview.tsx` 在 `md` 以下改顯示 `WorkspaceMobileNav`，主內容單欄。
- 工作台頂欄 `WorkspaceChrome.tsx` 使用 `top: { xs: 56, sm: 64 }`、頂欄 `minHeight: 44`；`xs` 會隱藏前段麵包屑並讓 breadcrumb 橫向捲動。
- 行動版觸控目標已有明確修正紀錄：`ProjectWorkspacePreviewActions.tsx` 註解提到原本 `IconButton size="small"` 約 30x30px 且太擠，於 `xs` 增加 padding/spacing。因此 AAS 手機版高風險操作不應只用一排小 icon。

### Repo 內後端資料形狀

- `AgenticQueryOutput` 已有 `Steps []AgentLoopStep`、`Proposals []AgentProposal`、`Usage *AIProviderUsage`。
- `AgentLoopStep` 記錄每輪 `ToolCalls` 與 `Results`；工具錯誤會被保留，不會讓整個 loop 直接中止。
- `AgentProposal` 目前是 `{ ToolCallID, ToolName, Arguments }`，寫入工具會被 `CaptureWriteToolsAsProposals()` 攔下，不會真的執行。
- `ApplyAgentProposal()` 的設計是前端把當初收到的 `ToolName` / `Arguments` 原樣送回，後端再檢查工具是否允許寫入、是否限縮在 project 內。
- 聊天訊息目前沒有獨立 `tool` role，工具過程會壓進 `StoryChatMessage.Metadata`，不是每次 tool call 都存一則訊息。

### 外部產品模式參考

- OpenAI Apps/Connectors 的 write action 原則是外部動作前要請使用者確認；這點可直接對應 AAS 的「提案不落地、使用者確認後才套用」。
- Claude tool use 文件描述的是標準 agentic loop：模型提出 tool call，應用程式執行，再把 tool result 餵回模型。這對應 AAS 目前的 `RunAgentLoop()`。
- Cursor Agent 文件把工具分成搜尋、讀檔、編輯、執行命令等，並提供 checkpoint/restore；可參考它把工具活動與可回退點放進同一條任務時間線的概念。
- Windsurf Cascade 文件強調 tool calls、continue、checkpoints/reverts；可參考它把 agent 過程視為一個可審查的工作流，而不是純聊天。

參考連結：

- OpenAI Apps: https://help.openai.com/en/articles/11487775-connectors-in
- Claude tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works
- Cursor Agent: https://prod.cursor.com/docs/agent/overview
- Windsurf Cascade: https://docs.windsurf.com/de/windsurf/cascade/cascade

## 核心設計判斷

主建議：AAS 不要把「工具呼叫」做成一堆通知，也不要把 raw log 永遠攤開。應該把每次 agent run 當成一個「可展開的工作軌跡」，預設只露出當下正在做什麼與最後摘要，使用者需要時再展開看細節。

原因：

- 作者主要任務是讀寫故事，不是監控 log；每次讀一篇 lore 就跳 Snackbar 會打斷閱讀節奏。
- 但完全黑盒也不行，尤其 agent 可能讀了不相干設定集或提出跨目標修改，使用者必須知道它看過什麼。
- 既有前端已經有 chat bubble、Chip、Accordion、Dialog、Snackbar、History panel，足夠組出透明但不吵的流程，不需要另開一套全新 UI。

## 1. 工具呼叫過程資訊呈現

### 主建議：在 assistant 訊息內放「工作軌跡摘要」，細節用 Accordion 展開

Agent 執行中時，在目前的 pending assistant bubble 內顯示一行動態狀態：

```text
AI Agent
  ◌ 正在讀取設定集：莉亞人物設定
  已讀 2 項內容 · 1 個工具執行中
```

Agent 完成後，顯示成可展開摘要：

```text
AI Agent
  這段可以改成更懸疑的語氣，我已經參考了前後章節與角色設定...

  ▸ 工作軌跡：讀取 4 項 · 0 個錯誤 · 12,430 tokens
    storyteller_get_story      第三章：雨夜        成功
    storyteller_list_lore      設定集列表          成功
    storyteller_get_lore       莉亞人物設定        成功
    storyteller_get_asset      舊碼頭照片          成功
```

顯示層級建議：

- 第一層：只顯示「正在做什麼」或「做過幾件事」，例如「正在讀取故事：第三章」。
- 第二層：展開後顯示工具名稱、中文化動作、目標名稱、狀態、錯誤。
- 第三層：需要 debug 時才顯示 arguments/result 摘要，不預設顯示完整全文結果。

工具名稱應中文化，不直接裸露 `storyteller_get_lore` 當主要文案：

| Tool | UI 動詞 |
| --- | --- |
| `storyteller_list_stories` | 列出故事 |
| `storyteller_get_story` | 讀取故事 |
| `storyteller_list_lore` | 列出設定集 |
| `storyteller_get_lore` | 讀取設定集 |
| `storyteller_list_assets` | 列出資產 |
| `storyteller_get_asset` | 讀取資產 |
| write tools | 建立提案 |

### 狀態呈現

```text
處理中：spinner +「正在讀取故事：第三章」
成功：check icon +「已讀取故事：第三章」
錯誤：warning icon +「讀取設定集失敗：找不到指定設定」
被攔截成提案：edit icon +「已建立修改提案，尚未套用」
```

錯誤不應跳 Snackbar，除非整次 agent run 失敗。單一工具錯誤屬於這次 agent 推理過程的一部分，應放在工作軌跡裡，最後回覆可補一句「有一筆設定集讀取失敗，因此我只依目前可讀內容判斷」。

### 為什麼不採用其他做法

- 不建議每個 tool call 都 Snackbar：這會把「過程」當成「事件通知」，在 agent 連續讀多筆資料時非常吵。
- 不建議把 tool call 存成一堆 chat message：既有 DB 沒有 `tool` role，而且訊息串會被過程訊息塞爆。
- 不建議只在最後顯示「已完成」：使用者無法判斷 agent 是否讀了錯的故事或漏讀設定。

## 2. 寫入提案與 diff 確認流程

### 主建議：聊天內嵌「提案卡片」，完整 diff 用 Dialog

聊天訊息串應保留上下文與決策紀錄，但完整 diff 不應塞在 chat bubble 裡。原因是目前 AI panel 在桌面只佔 `lg:5`，訊息 bubble 最大寬度 92%，很難容納左右對照 diff；手機更會變成長到難以操作。

建議採用混合式：

- assistant 回覆內嵌一張或多張「提案卡片」。
- 卡片顯示摘要、狀態、主要操作。
- 點「檢視 diff」開 `Dialog maxWidth="lg"`，沿用 `StorytellerVersionCompareDialog` / `CustomDiffSection` 的視覺與 RWD。
- `sm` 以下沿用既有慣例改 `fullScreen`。

### 提案卡片草圖

```text
┌─────────────────────────────────────────────┐
│ 修改提案 #1                       待確認     │
│ 目標：故事 / 第三章：雨夜                    │
│ 動作：更新故事內容                           │
│ 變更：標題 0 行、摘要 0 行、內容 18 行差異    │
│ 依據：版本 #42 · AI Agent：懸疑改寫助手       │
│                                             │
│ [檢視 diff] [套用提案] [取消]                │
└─────────────────────────────────────────────┘
```

卡片必要欄位：

- `proposal_id` 或可追溯的 `tool_call_id`
- 目標類型：故事 / 設定集 / 資產 / 冊
- 目標名稱與 public id
- 動作類型：更新 / 刪除 / 移動 / 回退 / 建立
- 差異摘要：幾個 section 有變更、幾行差異
- 基準版本：套用前版本 id 或更新時間
- 狀態：`pending` / `applying` / `applied` / `rejected` / `stale` / `error`

> 現有 `AgentProposal` 只有 `ToolCallID`、`ToolName`、`Arguments`。前端要做穩定 diff 與 stale 判斷，Phase 5/6 的 HTTP contract 建議補 `proposal_id`、`target`、`base_version_id`、`diff_summary`、`status`。如果暫時不落 DB，也至少要在 response 內提供這些衍生欄位，避免前端每次都從 raw arguments 猜。

### diff Dialog 草圖

```text
┌──────────────────────────────────────────────────────────────┐
│ 第三章：雨夜 修改提案                         [X]             │
│ 待確認 · 18 行差異 · 基準版本 #42                              │
├──────────────────────────────────────────────────────────────┤
│ 變更摘要                                                     │
│ - 內容：18 行差異                                             │
│ - 設定集/標題/摘要：無變更                                     │
│                                                              │
│ [Legend: 新增 / 刪除 / 修改]                                  │
│                                                              │
│ ▾ 內容                                                       │
│ ┌ 舊版本 ───────────────┬ 新提案 ───────────────┐             │
│ │  12  她走進碼頭。      │  12  她停在碼頭邊，... │             │
│ │ -13  風很冷。          │ +13  風從倉庫縫裡刮出...│             │
│ └───────────────────────┴───────────────────────┘             │
├──────────────────────────────────────────────────────────────┤
│ [取消提案]                              [套用提案]             │
└──────────────────────────────────────────────────────────────┘
```

Dialog 互動：

- 「套用提案」按下後進入 `applying`，button disabled 並顯示 progress。
- 成功後關閉 Dialog，chat 內卡片改成 `已套用`，右下角 Snackbar 顯示「已套用 AI 修改提案。」。
- 取消後卡片改成 `已取消`，保留在聊天紀錄中，但收合差異摘要。
- 套用失敗時 Dialog 不關閉，顯示 inline `Alert severity="error"`，卡片狀態改 `套用失敗`。
- 如果目前故事/設定集版本已經不是提案的 `base_version_id`，卡片改 `需要重新比對`，不能直接套用；按鈕改成「重新產生 diff」或「以目前版本重算」。

### 危險操作

不是所有寫入提案都只是 upsert。`WriteStorytellerToolNames()` 可能包含 delete/move/revert/presign/confirm 類工具。第一版建議：

- 更新故事/設定集內容：diff Dialog 內按「套用提案」即可，不再額外跳 confirm。
- 刪除、回退、移動：diff/摘要 Dialog 內按「套用提案」後，再開一次簡短 confirm dialog，文案明確列出目標與後果。
- 資產 presign/confirm 這類流程性工具：不要讓 agent 直接提出可套用提案，除非 Phase 5 明確定義資產寫入安全流程。

## 3. 多個待確認提案的呈現

### 主建議：同一則 assistant 回覆下方顯示「提案堆疊」，review 時一次聚焦一個

Agent 一次提出多個修改時，不要讓它們散成多則 assistant message，也不要一開始就把每個 diff 全部展開。建議在同一則回覆下方放一個 proposal stack：

```text
AI Agent
  我準備了 3 個修改提案：主線章節語氣、莉亞設定集補充、冊排序調整。

┌ 待確認提案 3 項 ──────────────────────────────┐
│ 1  故事 / 第三章：雨夜        18 行差異  待確認 │
│ 2  設定集 / 莉亞人物設定       4 行差異  待確認 │
│ 3  冊 / 第一卷                移動 1 篇  待確認 │
│                                                │
│ [逐項檢視]                                     │
└────────────────────────────────────────────────┘
```

點「逐項檢視」後：

- 桌面：開 diff Dialog，左側或上方放提案清單，右側/下方顯示目前選取提案的 diff。
- 手機：fullscreen Dialog，上方用 compact stepper 或 tabs：「1/3 故事」「2/3 設定集」「3/3 冊」。
- 每個提案都有獨立狀態與獨立套用/取消。

### 不建議第一版做「全部套用」

第一版不建議提供醒目的「全部套用」。理由：

- Storyteller 的寫作變更不是機械式 refactor；使用者通常需要逐項讀語氣與設定是否合理。
- 多提案可能互相依賴，也可能同時碰到故事與設定集；全部套用會放大誤操作成本。
- 若未來要做，可只在「同目標、非危險操作、base version 全部仍有效」時提供次要按鈕「套用全部安全提案」，且仍要先顯示總摘要。

### 排序與分組

排序建議：

1. 先顯示目前正在編輯的故事/設定集。
2. 再顯示同 project 內其他故事。
3. 再顯示設定集。
4. 最後顯示冊、資產等非文字內容。
5. 危險操作永遠排在最後，並用 warning 色標。

卡片內只露出摘要，避免眼花：

- 類型 chip：故事 / 設定集 / 冊 / 資產
- 目標名稱：一行 ellipsis
- 差異量：`18 行差異`
- 狀態 chip：待確認 / 已套用 / 已取消 / 已失效

## 4. 套用後的變更回饋與回退入口

### 主建議：同時更新三個地方

套用成功後，使用者要立刻知道「剛剛發生什麼」與「去哪裡回退」。建議同時做三層回饋：

1. Snackbar：短暫告知成功。
2. 聊天內提案卡片：永久留下這次套用紀錄。
3. 編輯歷史 panel：新增版本來源與回退入口。

### 套用後卡片狀態

```text
┌─────────────────────────────────────────────┐
│ 修改提案 #1                       已套用     │
│ 目標：故事 / 第三章：雨夜                    │
│ 已建立版本：#43                              │
│ 套用前版本：#42                              │
│                                             │
│ [查看變更] [回復到套用前版本] [查看編輯歷史] │
└─────────────────────────────────────────────┘
```

`查看變更`：開啟版本比對 Dialog，比對 `#42` 與 `#43`。

`回復到套用前版本`：直接呼叫既有 revert 能力，把內容回到套用前版本。這個按鈕必須保留在 chat 卡片上，因為使用者最常是在讀完 AI 回覆後立刻反悔，不一定知道要去 history panel 找哪個版本。

`查看編輯歷史`：切換 `StorytellerEditorSideTabs` 到 `history`；非 embedded 模式同步 URL 到 `/diff`，沿用 `StoryEditor.tsx` 既有行為。

### 編輯歷史標記

`StoryEditHistory` 目前已有 `source`、`revertedFromVersionId`、`conflictedWithVersionId` chip。AAS 套用後建議：

- `source` 顯示「AI Agent」或「AI Agent / 懸疑改寫助手」。
- 新版本 title 區域加 chip：`來自提案 #1`。
- 如果是回退產生的新版本，沿用現有 `回復自版本 #x` chip。

### stale / conflict

若套用時發現 base version 已不是最新：

- 不要默默套用。
- 卡片顯示 `版本已變更` warning。
- 提供「用目前版本重新比對」。
- 若後端允許強制套用，按鈕必須是次要操作，文案明確：`仍以目前版本套用`，並在結果版本加 conflict chip。

## 5. 手機版體驗

### 沿用既有 RWD 規則

AAS 前端應延用目前 Storyteller 的 responsive 習慣：

- 斷點使用 MUI 預設 `xs/sm/md/lg`，不要自行發明一套 media query。
- 工作台主要 mobile 判斷延用 `theme.breakpoints.down("md")`。
- diff Dialog 在 `theme.breakpoints.down("sm")` 時 fullscreen，延用 `StorytellerVersionCompareDialog.tsx`。
- 內容排版使用 `Stack direction={{ xs: "column", sm: "row" }}` 與 `Grid size={{ xs: 12, lg: ... }}` 的既有模式。
- 工具列與 action 在 `xs` 加大 spacing/padding；高風險操作用文字 Button，不用一排小 IconButton。

### 手機版工具軌跡

手機版預設只顯示一行狀態：

```text
正在讀取設定集：莉亞人物設定
```

完成後顯示：

```text
工作軌跡：讀取 4 項 · 12,430 tokens  [展開]
```

展開內容使用單欄列表，不顯示表格：

```text
✓ 讀取故事：第三章：雨夜
✓ 列出設定集：12 筆
! 讀取資產：舊碼頭照片失敗
```

### 手機版提案卡片

卡片滿版，按鈕直向排列或兩列排列：

```text
┌ 修改提案 #1 ───────────────┐
│ 故事 / 第三章：雨夜          │
│ 18 行差異 · 待確認           │
│ [檢視 diff]                 │
│ [套用提案]                  │
│ [取消]                      │
└────────────────────────────┘
```

`檢視 diff` 開 fullscreen Dialog。底部操作列 sticky：

```text
┌────────────────────┐
│ fullscreen diff     │
│ ...                 │
├────────────────────┤
│ [取消] [套用提案]   │
└────────────────────┘
```

這符合手機上「看長 diff 時底部仍能操作」的需求，也避免使用者滑到底才找得到確認按鈕。

### 手機版多提案

多提案 review 用 stepper，不用左側清單：

```text
提案 1 / 3
[上一項] [下一項]

故事 / 第三章：雨夜
18 行差異

diff...

[取消此提案] [套用此提案]
```

已套用/已取消後自動跳下一項，但要保留 toast：

- `已套用第 1 個提案。`
- `已取消第 2 個提案。`

不要在手機版提供「全部套用」作為主操作。

## 建議的前端資料狀態

雖然這份文件不要求實作，但 Phase 6 API contract 最好能讓前端不用從 raw JSON 硬猜：

```ts
type AgenticToolStepView = {
  id: string;
  toolName: string;
  actionLabel: string;
  targetType: "story" | "lore" | "asset" | "volume" | "project" | "unknown";
  targetTitle: string;
  status: "running" | "success" | "error" | "proposal";
  errorMessage?: string;
};

type AgenticProposalView = {
  id: string;
  toolCallId: string;
  toolName: string;
  targetType: "story" | "lore" | "asset" | "volume";
  targetPublicId: string;
  targetTitle: string;
  baseVersionId?: string;
  resultingVersionId?: string;
  status: "pending" | "applying" | "applied" | "rejected" | "stale" | "error";
  diffSummary: { section: string; changedLines: number }[];
  arguments: Record<string, unknown>;
};
```

若 Phase 5 決定不把 proposal 落 DB，也建議在 chat message metadata 內保留足夠資料，讓重新載入聊天歷史時仍能顯示「當時提出過什麼、是否已套用、能否回到套用前版本」。否則使用者重新整理後會失去安全感。

## 前端互動流程

### 唯讀 agentic 查詢

1. 使用者打開 AI Agent panel，送出需求。
2. pending assistant bubble 顯示目前工具呼叫狀態。
3. 工具呼叫完成後，assistant bubble 顯示最終回答。
4. bubble 下方顯示收合的工作軌跡摘要。
5. 若有工具錯誤，工作軌跡摘要用 warning chip；整次失敗才顯示 error Alert。

### 單一寫入提案

1. 使用者要求「把這段改得更懸疑」。
2. Agent 讀取上下文，提出 `storyteller_upsert_story` proposal。
3. assistant bubble 顯示文字說明與一張提案卡。
4. 使用者點「檢視 diff」。
5. Dialog 顯示舊版本 vs 新提案。
6. 使用者點「套用提案」。
7. 成功後 Snackbar 顯示「已套用 AI 修改提案。」。
8. 卡片變 `已套用`，出現「查看變更」「回復到套用前版本」「查看編輯歷史」。

### 多個寫入提案

1. assistant bubble 顯示「待確認提案 3 項」堆疊。
2. 使用者點「逐項檢視」。
3. Dialog 進入 proposal review queue。
4. 使用者逐項套用或取消。
5. 所有項目處理完後，Dialog 顯示總結：

```text
已套用 2 項，取消 1 項。
[查看編輯歷史] [關閉]
```

## 實作優先順序建議

1. 工具軌跡摘要：先支援完成後顯示，不必第一版就做 streaming。
2. 單一 upsert proposal diff：先支援故事與設定集內容更新。
3. 套用後 receipt + revert 入口：這是安全感的核心，應跟提案套用同一階段完成。
4. 多 proposal review queue。
5. 危險操作 proposal：delete/move/revert 需要更嚴格 confirm，排在內容更新後。
6. streaming / 即時 tool call 狀態：等 HTTP route 與後端 event 格式穩定後再做。

第一版即使無 streaming，也可以在回應完成後把 `Steps` 呈現出來；這已經能解決「AI 黑盒」問題。Streaming 是體驗加分，不應阻塞整個 Phase 6。

## 結論

AAS 的 UI 不應變成 log console，也不應繼續維持黑盒聊天。最適合 Storyteller 的形狀是：

- chat 保留對話脈絡；
- tool calls 變成可展開工作軌跡；
- write tools 變成可審查 proposal；
- diff review 沿用既有版本比對 Dialog；
- 套用後在 chat receipt 與 history panel 都留下可回退入口；
- 手機版用 fullscreen review、單欄工具列表、足夠大的文字按鈕。

這樣能延續目前 Storyteller 編輯器的 RWD 與元件慣例，同時把 agentic 的透明度與安全網補上。

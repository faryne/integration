# 所見即所得編輯器 Notion 化定案版（Claude × Codex 收斂結論）

## 文件關係

這份文件是目前**唯一**需要動工前參考的版本，取代並收斂了以下四份前文：

- `所見即所得編輯器分析_claude.md`——Claude 獨立查證分析
- `所見即所得編輯器分析_codex.md`——Codex 分析，內含 Claude 加註的審查章節
- `所見即所得編輯器notion-like分析_claude_final,.md`——Claude 整合版（含使用者 2026-08-13 拍板）
- `所見即所得編輯器notion-like分析_codex_final,.md`——Codex 獨立 final 版

上述兩份「_final」文件在表格序列化格式與圖片插入現況兩點上仍有實質分歧，本文件透過 Claude 對 code 的實際查證、以及 Claude 與 Codex 在同一個 Codex CLI session（`019ff88e-5904-7603-bd56-0202486dc89b`）內的兩輪直接對話收斂而成。四份前文內容已完全被本文件吸收，已於 commit `7717952` 一併刪除，不再保留；後續動工請以本文件為準。

## 結論

1. **保留 Tiptap / ProseMirror，不換 editor framework**。這是操作入口改版，不是重寫編輯器。
2. **建立 Command Registry 是所有後續工作的收斂點**，工具列、右鍵、slash、bubble menu 四個入口共用同一套 command 定義。
3. **操作入口分三種情境**：空白段落 `/`（區塊插入／轉換）、選取文字後右鍵（行內樣式＋新增情境判斷）、選取文字後 bubble menu（常用行內樣式，工具列拔除後的可發現性補償）。
4. **工具列拔到完全消失**，但需要明確驗收條件（見 Phase 6）才移除，且要幫語法說明側欄另找入口。
5. **真表格採 cell 級互動＋逐列一行儲存**：使用者要的是操作起來像 Notion 的真表格（可新增/刪除列欄、編輯 cell），但儲存格式**不打破**現有「一行＝一個頂層 block」的架構——這點原本兩份 final 文件不一致，已在本輪對話中收斂定案（見下方「真表格最終設計」）。

## 現況查證重點（已確認，不是推測）

- 工具列（約 762–1019 行）是目前唯一完整入口，涵蓋標題／粗體／斜體／底線／上下標／對齊／`blockKind`／文字色／背景色／連結／腳注／註解／匯出／語法說明。
- 右鍵選單已存在，但是**固定清單**，不論游標在哪都顯示同一批行內樣式項目，完全沒有「空白段落插入區塊」這個情境。
- `/` slash command 與 bubble menu **完全沒有開始**。
- **`---` 分隔線 input rule 已確認存在**：`wysiwygCore/markerParagraph.ts:265–270`，`find: /^---$/` 觸發 `insertHorizontalRule()`。不需要額外查證或工作（原 Claude final 文件此處寫「待確認」已過時，本輪已用 code 驗證修正）。
- Markdown 自動 render：Bold／Italic 用官方 extension 內建 input rule，但 Italic 官方預設會誤吃單底線 `_文字_`（既有 bug）。Underline／Subscript／Superscript 官方 extension **沒有內建 input rule**，`++`／`~`／`^` 目前不會自動轉換。
- 表格目前是 `blockKind: "table-row"`，每行行首 `|`，編輯區是純文字，沒有真正 cell grid；只有 `StorytellerWysiwygMarkdown.tsx` 閱讀端才把連續 `table-row` 段落分組渲染成 `<table>`。
- **圖片插入現況已修正**（原 Claude final 文件此處描述有誤，本輪查 code 確認）：`StorytellerWysiwygEditor.tsx` 已透過 `useImperativeHandle` 暴露完整可用的 `insertAsset(asset)` method（約 288、435 行），`StoryEditor.tsx`（約 965、1508、1712 行）與 `LoreEditor.tsx`（約 720、1398 行）都已用「頁面層 `toolbarExtra` 按鈕 → 開 `StorytellerAssetPickerDialog` → `onSelect` 呼叫 `editorRef.current.insertAsset(...)`」這條路徑，且可運作，不是只能靠拖曳。真正要做的工作是**把這條已存在的流程改成 command registry 的一個 command**（不持有頁面 state，透過 context callback 開 asset picker，讓 slash `/圖片`、右鍵「插入圖片」都能呼叫），比原本估計的「從 0 建一整套流程」小，但也不是「換個入口」那麼輕——asset picker 開啟仍依賴頁面層 `assetPickerOpen` state，command 呼叫時需要一個 context/callback 機制才能觸發它，這件事兩份前文都沒講清楚要怎麼接，實作時要一併設計。
- `--` 與 `---` 語意已確認：`--文字--` 是刪除線，`---` 維持分隔線，兩者分屬不同解析階段，理論上不衝突，但要補邊界測試。
- `StorytellerWysiwygEditor.tsx` 已經 1597 行，是既有技術債，Notion 化如果不同步拆檔會繼續惡化。
- **MCP 工具資料流已確認**（本輪新查證，會反向決定表格序列化格式）：`storyteller_get_story`／`storyteller_get_lore` 回傳給 AI agent 的 `content` 是 DB 存的**原始字串**，沒有經過任何 render／去 marker 處理；`storyteller_upsert_story`／`storyteller_upsert_lore` 幾乎直接落地存進 DB，**沒有 marker 語法驗證層**，只檢查 `asset://` 參照合法性。AI agent 目前是照 prompt 裡的 `storytellerContentSyntaxHint`／`storytellerContentMarkerHint` **手寫**合法 marker 語法。這代表 Storyteller 的內容格式有一個兩份前文都沒明講、但實際是核心約束的前提：**格式必須是 AI agent 能透過 MCP 直接讀寫的純文字語法**，不只是「人類可讀」而已。

## 使用者拍板結果（2026-08-13）

### 1. 表格範圍：確定採真正 cell 級表格（互動層級，無爭議）

要做出「操作起來像 Notion 表格」的真表格：可新增/刪除列欄、編輯 cell，不是 `table-row` 那種 markdown pipe 半殘表格。這件事使用者已拍板，兩份前文一致，無爭議。

**「怎麼存」這件事有爭議，已在本輪對話收斂**，見下方「真表格最終設計」一節——結論是**不需要**打破一行一段落的架構，原 Claude final 文件在此處的假設（「這會第一次打破一行＝一個段落」）已被推翻。

### 2. 標題語法：確定涵蓋 H1–H6

`##` 只是舉例，涵蓋 H1–H6。白名單已支援，無額外工作。

### 3. 工具列：確定拔到完全消失

不保留極簡求助 icon。`StorytellerWysiwygSyntaxDrawer`（語法說明側欄）需要另找一個不算「工具列」的落腳處，Phase 6 一併處理。

## 真表格最終設計（本輪對話收斂，取代兩份 final 文件各自的假設）

這是本文件與前兩份 final 文件最大的差異點。Claude final 原本假設真表格必須用跨多行巢狀 marker、會打破 line-based 架構；Codex final 原本留給「Phase 2 spike 再決定」、且傾向單行 escape marker。Claude 與 Codex 在本輪 Codex CLI session 內直接討論兩輪，中途 Codex 一度提出「單行 base64url(JSON) marker」的方案，但 Claude 查證 MCP 資料流後指出：AI agent 是透過 MCP 直接讀寫原始 content 字串、沒有語法驗證層，base64 blob 會讓 AI agent 完全無法合理讀寫表格內容。Codex 據此修正立場，最終定案如下。

### 儲存格式：逐列一行 marker（不是 base64 blob，也不是跨多行巢狀 marker）

```text
⟦table tableId="tbl_xxx" rowId="row_1"⟧| 角色 | 任務 | 狀態 |⟦/table⟧
⟦table tableId="tbl_xxx" rowId="row_2"⟧| 莉亞 | 偵查 | **完成** |⟦/table⟧
⟦table tableId="tbl_xxx" rowId="row_3"⟧| 米菈 | 支援 | --取消-- |⟦/table⟧
```

- 相鄰、同 `tableId` 的 table row marker 由 parser group 成同一張表。
- 每一行仍是一個獨立的頂層 block，符合 `content.split("\n")` 的既有假設——**不需要**新的巢狀資料模型，也**不需要**重新設計書籤與 diff 的根基。
- `rowId` 用來穩定追蹤列；AI 可手寫簡單 id（如 `row_1`），前端載入後若缺少/重複可自動補正。
- 欄數由該表所有 row 中最多 cell 數推導，較短的 row 補空 cell；新增欄時 serializer 把每一列都補一格空 cell。
- 不設跨多行的 table start/end wrapper，避免額外控制行污染 `line_index`。
- 與舊 `table-row`（`blockKind: "table-row"`）的差異：舊模式編輯區仍是純文字段落，只在閱讀頁 render 成 table；新模式編輯器內是 Tiptap true table node，可做真正的列欄操作與 cell 編輯，只是 serialize 到 DB 時仍落成「每列一行」。

### Cell 內容 escape 規則

Row marker 內容必須是 pipe table 格式：`| cell 1 | cell 2 | cell 3 |`。

- 未 escape 的 `|` 是 cell boundary。
- `\|` 表示 cell 文字中的 literal pipe。
- `\\` 表示 literal backslash。
- `\n` 表示 cell 內的 soft line break；DB 裡仍是兩個字元 `\` + `n`，不產生真換行、不影響 `line_index`。
- 其他反斜線組合不特別處理，只針對 `\|`、`\\`、`\n` 三種做 unescape。
- **不需要 escape**：`**`、`__`、`++`、`--`、`~`、`^` 等既有行內 delimiter，以及 `⟦a-id ...⟧`／`⟦comment-id ...⟧`／`⟦footnote-id ...⟧` 等既有行內 marker，都可直接放在 cell 內容裡，交給既有 inline parser 處理。
- 若 link href、footnote note、comment 內容裡真的含 `|`，serializer 必須輸出成 `\|`，否則 cell split 會切錯；MCP syntax hint 要明確寫這條規則。

解析順序：① 辨識整行是否為 `⟦table ...⟧...⟦/table⟧` → ② 取出 row text → ③ 用 unescaped `|` 切 cells → ④ 對每個 cell 做 table-level unescape（`\|`／`\\`／`\n`）→ ⑤ cell content 交給既有 inline parser 處理粗體/連結/註解/腳注等。

### 書籤影響

- 維持 line-based，不需要改 `line_index` schema。
- 第一版：`line_index` 指到 table 的某一列（row-level），不支援 cell-level 定位。Reader 上可高亮該 row 或整張表，建議先做 row 高亮，因為 `line_index` 本來就是行定位。
- 未來若要 cell-level bookmark，再另加 `cell_index` 之類的 metadata，不現在就改 `line_index` 語意。

### Diff 影響

- 維持逐行 diff 模型。每個 table row marker strip 後轉成 readable row（例如 `| 角色 | 任務 | 狀態 |`）顯示。
- row 內容變更顯示該行 diff；新增/刪除列自然對應新增/刪除行；新增/刪除欄會造成多行同時變更，第一版可接受此行為。
- 不做 cell-level diff。未來若要更細，在 diff UI 層 parse table row 後做 cell compare即可，storage 不需要再改。

### MCP／AI Agent 範圍：第一版允許 AI 透過 MCP 讀寫表格

因為格式是可讀、可局部修改、可照 syntax hint 手寫的純文字，不需要 AI 做任何 encode/decode，**第一版不排除 AI agent 透過 MCP 建立/編輯表格**。`storytellerContentMarkerHint` 需新增明確範例與規則說明（同一張表多列共用 `tableId` 且必須相鄰、每列一行、cell 用 `|` 分隔、cell 內 literal `|` 要寫 `\|`、cell 內可用既有行內語法）。

MCP 層第一版不強制做完整 validation，但 parser／reader 端需要保護性 fallback：malformed table row 不丟資料；無法 parse 時退回純文字顯示；`tableId` 缺失時視為單列單表或載入後補 id；row cell 數不一致時補空 cell。

### 舊資料相容與遷移（本輪對話新增，補充兩輪 Codex 對話遺漏的細節）

- **編輯體驗完全不變**：舊 `table-row` 段落在編輯器裡繼續顯示成一串各自獨立的段落逐行編輯，**不會**因為打開文件就被自動升級成新表格——這是刻意設計，避免使用者只是打開文件就在使用者沒意識到的情況下改變資料形狀（進而影響 diff／書籤）。
- **閱讀頁與匯出不變**：parser 保留讀取能力，reader 繼續能渲染舊資料成 `<table>`；export markdown 時新舊表格都輸出成標準 markdown table。
- **手動升級**：提供「轉換成新表格」command（游標落在舊 `table-row` 區塊時的右鍵選單項），使用者主動觸發才把該區塊改寫成新的 `⟦table⟧` marker 格式；下次存檔才真的落地成新格式。不靜默自動轉。
- **貼上純文字 pipe table 不會被自動辨識**：如果使用者直接貼一段標準 markdown table 純文字（例如 `| A | B |\n|---|---|\n| 1 | 2 |`），目前的 `table-row` blockKind 是靠段落屬性標記、不是靠 parser 偵測文字樣式，這類貼上內容會被當成一般段落文字，不會自動變成 `table-row` 也不會變成新表格——這個行為改版前後一致，不是這次改版要解決的問題，範圍外。
- **既有 `^\| $` input rule 需要處理的漏洞**：`markerParagraph.ts` 現有一條 input rule，在段落開頭打 `| ` 會自動把段落設成 `blockKind: "table-row"`（舊格式）。真表格上線、`/table` 成為正式入口後，這條路徑若不處理，使用者手動打 `| ` 仍會產生「新的舊格式」內容，跟「新增內容不再產生 `table-row`」的定案原則矛盾。**Phase 5 實作時需要移除這條 input rule，或改接到 `/table`**（打 `| ` 觸發真表格插入，而不是產生舊格式段落），確保這個原則沒有漏洞。

### 第一版明確不做

合併儲存格、調整欄寬、排序、公式、巢狀表格、cell-level bookmark、cell-level diff。

## 分階段工作計畫

排序原則：風險最低、跟其他決策無依賴的先做。表格（Phase 5）排在工具列移除（Phase 6）之前——工具列能不能安全拔掉，取決於 slash／右鍵是不是已涵蓋「所有」區塊操作，而真表格的新增列/欄、刪除列/欄、編輯 cell 也是區塊操作的一部分。

### Phase -1：WYSIWYG Playground（前置項目，Track A 負責，所有 Phase 之前）

使用者提議「複製一套全新編輯器、demo 頁驗證後再抽換」，經 Claude 與 Codex 討論後定案為**不整套複製**：`wysiwygCore/` 的 whitelist／parser／serializer／marker 是編輯器、Reader、diff 頁、匯出、後端字數、MCP 工具共用的格式契約，複製一份會製造雙 parser/serializer，之後容易漂移（Reader 讀不懂新編輯器存的內容、匯出/MCP 格式不一致）；真正需要隔離的是「UI 互動與開發驗證場景」，不是格式核心。且若真的整套複製，最後「抽換」正式頁面這一步本身就是風險，容易漏掉正式頁專屬 props（`toolbarExtra`、`projectPublicId`、`enabledFeatures`、`insertAsset()` ref 等）。

改採建立獨立 demo/playground 頁面，共用同一個 `StorytellerWysiwygEditor` 元件與 `wysiwygCore/`，不做元件複製：

- [x] 建立 `/storyteller/wysiwyg-demo` 或等效 dev playground route
- [x] 掛載同一個 `StorytellerWysiwygEditor`，不複製元件
- [x] 用本地 state 管理 `value`/`onChange`
- [x] 顯示 raw content textarea／preview／serialized output，方便檢查 marker——raw content textarea 已做；Reader preview pane 2026-08-14 補上（見 `WysiwygDemo.tsx`，直接掛 `StorytellerWysiwygMarkdown` 元件），Codex 進 Phase 5 沒有先補這塊，Claude 在 review Phase 5 reader renderer 時一併補上
- [x] 提供幾組 sample content：一般段落、行內 marker、腳注、註解、asset placeholder、舊 `table-row`（未來 table marker sample 待 Phase 5 表格格式定案後再補）
- [x] 不接 autosave、不接真實 story/lore API、不寫 DB
- [x] 若要測 asset insertion，可用 mock asset 或接現有 picker，但不要把 demo 假資料路徑污染正式 editor API

Phase 0–4（含最高風險的中文 IME 測試）都先在這個 playground 驗證，驗證過再接進 `StoryEditor.tsx`／`LoreEditor.tsx` 正式頁面。Track B 做 Phase 5 真表格時，也在同一個 playground 加 table sample 與互動驗證，雙方共用同一場驗證，不分兩套 demo。

### Phase 0：Markdown 自動 render 補齊（獨立先做，風險最低）

- [x] 修正 Italic 的 input rule，只接受 `*文字*`，排除官方預設會誤吃的單底線 `_文字_`
- [x] 為 Underline 補 custom InputRule，對應 `++文字++`
- [x] 為 Subscript 補 custom InputRule，對應 `~文字~`
- [x] 為 Superscript 補 custom InputRule，對應 `^文字^`
- [x] 新增刪除線 mark（`--文字--`）：`whitelist.ts` 新增 `strike`（實作時對齊 Tiptap 官方 mark type name，未沿用文件原本的 `strikethrough`，已與 Codex 對過）／新增 `@tiptap/extension-strike`（覆寫官方預設吃 `~~` 的 input rule，改成只認 `--`）／`serializer.ts`／`exportMarkdown.ts`／`StorytellerWysiwygMarkdown.tsx`／`StorytellerWysiwygSyntaxDrawer.tsx`／工具列與右鍵選單／後端 `wordCount()`／MCP syntax hint 都已補上
- [x] 補測試：`--`（行內刪除線）與 `---`（行首分隔線）不互相誤判——以 Go 後端測試涵蓋（`wordcount_strikethrough_test.go`），前端沒有既有測試框架，改在 Phase -1 playground 人工瀏覽器實測驗證（見下方 IME 項）
- [x] ~~確認分隔線 `---` 是否已有 input rule~~ **已確認存在（`markerParagraph.ts:265-270`），無需額外工作**
- [ ] 人工實測中文 IME：組字中途輸入 `*`／`_`／`+`／`~`／`^`／`-` 等符號的行為——已用瀏覽器自動化對 playground 做過「已組字完成」文字的逐字元真實按鍵測試（`--`／`++`／`~`／`^`／`*`／`_`／`**` 都正確觸發/正確排除），但組字「中途」的行為無法自動化模擬，完整測試步驟已整合進 Phase 9.1，這是風險清單裡標記最高風險的一項，不要跳過
- [x] Bold/Italic 既有官方 input rule 在目前自訂 `MarkerParagraph` schema 下是否正常運作，已實測：`**bold**`／`*italic*` 都正確觸發，`_italic_` 正確被排除

### Phase 1：Command Registry（抽象層，不改變現有 UX）

- [x] 新增 `wysiwygCore/commands.ts`，把現有工具列與右鍵選單裡的每個動作轉成統一 command 描述——實作時跟原規格有兩點偏離，已記錄理由：① 多加一個 `group` 欄位（mark/align/block/color/annotation/utility）決定 UI 分區，不只是 scope；② `scope` 多一個 `action` 值（匯出這類不動編輯器內容、只是觸發副作用的動作，塞進 inline/block/insert 會誤導）；③ `enabled` 拆成 `isActive`（是否高亮）／`isEnabled`（是否可執行）／`isVisible`（是否該顯示）三個獨立欄位，因為既有 UI 這三種狀態本來就是分開判斷的（例如註解按鈕同時有「未選字時 disabled」跟「選字/游標在既有註解裡時 active」兩種獨立語意），硬塞成一個 `enabled` 會遺失資訊
- [x] 工具列改成從 command registry 產生按鈕（mark／align／block／annotation／utility 五組都改了；color 的「開啟色盤」觸發按鈕跟 select 標題下拉維持原本 bespoke 寫法，因為它們是「開啟子選單」而不是單一 command，色盤內的每個顏色選項本身仍是 command）
- [x] 右鍵選單改成從 command registry 產生項目，JSX 拆成獨立元件 `StorytellerWysiwygContextMenu.tsx`；腳注/註解的「快速移除」是右鍵選單獨有的捷徑（工具列沒有對應按鈕），command registry 沒有涵蓋，維持獨立 props 傳入
- [x] 補一份最小 smoke test，確認每個 command 的 `isActive`/`isEnabled`/`isVisible`/`run` 在空 editor state 下不會爆掉——前端原本完全沒有測試框架，跟使用者確認後新增 vitest（`static_site/vitest.config.ts`，獨立於 `vite.config.ts`，避免牽動正式 build plugin），`pnpm test` 可執行，3 個 test 都過
- [x] 瀏覽器實測（Phase -1 playground）：mark 切換（工具列＋右鍵選單）、blockKind 切換（引用）、顏色套用（右鍵選單色塊）、腳注快速移除（右鍵選單）、連結對話框開啟（工具列）都跟改版前行為一致，console 無新增錯誤（且意外修掉一個既有的 MUI Fragment-as-Menu-child warning，因為 annotation 群組改用 `.filter().map()` 取代 `{condition && <>...</>}` 片段寫法）

### Phase 2：右鍵選單 context-aware 化 + 資產圖片 command 化

- [x] 依 selection 狀態分兩大類主內容（有選取文字／沒有選取），表格 Phase 5 尚未實作、暫不放進選單：
  - 有選取文字：行內樣式（mark／文字色／背景色／加連結/腳注/註解）
  - 沒有選取（不分空白/非空段落，heading/blockKind 對兩者行為一致，比照原本工具列 Select/按鈕永遠可用）：標題（內文/H1-H6，新增到 registry 的 `heading` group）／引用/清單/表格列（既有 block command）／插入分隔線；游標在**空白**段落時才額外顯示「插入圖片」（非空段落插入圖片語意不明確，範圍內排除）
- [x] 游標落在既有 link/comment/footnote mark 裡時顯示編輯／移除——link 原本只有「編輯連結」（開對話框），這次補上跟 footnote/comment 對稱的「移除連結」快速選項；顯示邏輯是「有選取文字 || 游標在該 mark 裡」，沒有選取又不在既有 mark 裡就不顯示「加」（沒有目標文字）
- [x] **資產圖片插入 command 化**：新增 `StorytellerWysiwygEditorProps.onRequestInsertAsset` callback prop，`StoryEditor.tsx`／`LoreEditor.tsx` 的 `toolbarExtra`「插入資產」按鈕與新的 `insert-image` command 呼叫同一個 `() => setAssetPickerOpen(true)`；command 本身不持有頁面 state，透過 `WysiwygCommandContext.openAssetPicker` callback 觸發。slash command 是 Phase 3（Track B）的工作，這裡只確保 command registry 跟 context callback 機制就緒，Phase 3 直接複用
- [x] 確認 right-click inside selection 不會破壞 selection——沿用 Phase 1 已驗證過的既有邏輯（`handleEditorContextMenu` 的 `clickedInsideSelection` 判斷不變），本輪在 playground 重新實測一次：選取文字後在選取範圍內右鍵，選取範圍不收合，選單正確顯示行內樣式（mode A）

### Phase 3：Slash Command

- [x] 引入 Tiptap `Suggestion` utility，`/` 觸發，僅限空文字區塊、selection 為空時生效——2026-08-14 新增 `SlashCommand` extension，使用 `@tiptap/suggestion`、`/` startOfLine 觸發，`canShowSlashCommand()` 限制 selection 為空且目前段落只有 `/query` 時才顯示；Claude 在瀏覽器實測過：非空段落／游標不在段落開頭時打 `/` 不會觸發選單（`canShowSlashCommand` 邏輯確認），空段落打 `/` 正確顯示選單
- [x] 中英文 alias——2026-08-14 已在 command registry 補 `slashWysiwygCommands()` resolver，只列出 heading／block／insert 類 command，並補 heading／quote／list／table／image 的中英文 aliases；Claude 用 `npx vitest run` 驗證過 smoke tests，並在瀏覽器實測 `/tab` 正確篩到「插入表格」
- [x] 選擇 command 後正確刪除 `/query` 文字——2026-08-14 新增 `runSlashCommand()`，執行前先 `deleteRange(range)` 再呼叫 command registry 的 `command.run()`；Claude 在瀏覽器實測滑鼠點擊與鍵盤 Enter 兩種選取路徑，確認 `/query` 文字都正確刪除、不殘留（例如 `/table` + Enter 正確插入真表格，doc JSON 裡沒有殘留 `/table` 文字）。過程中發現並修正一個真實 bug：鍵盤 ArrowUp/ArrowDown/Enter/Escape 原本完全沒反應（`onKeyDown` 沒被 Suggestion plugin 呼叫到），改成用 `SlashCommand.addKeyboardShortcuts()`（`priority: 1000`，高於 `MarkerParagraph` 預設 100 的優先權）攔截這四個鍵，透過 WeakMap 存的 controller 呼叫同一份選取邏輯；修好後 Claude 重新在瀏覽器逐一測過 ArrowDown（highlight 正確移動）、Enter（正確執行 highlight 中的 command）、Escape（選單關閉、不執行 command、`/` 文字保留）、滑鼠點擊（無 regression）
- [ ] 人工實測中文 IME：輸入 `/標`、注音組字期間 suggestion menu 的互動、Escape/Enter 行為——已用瀏覽器自動化對「已組字完成」文字做過逐字元真實按鍵測試（ArrowDown／Enter／Escape／滑鼠都確認正確），組字中途行為無法自動化，完整測試步驟已整合進 Phase 9.1

### Phase 4：Bubble Menu

- [x] 選取文字時顯示：粗體/斜體/底線/下標/上標/刪除線/文字色/連結/腳注/註解——新檔 `StorytellerWysiwygBubbleMenu.tsx`，用 `@tiptap/react/menus` 的 `BubbleMenu`（注意：`@tiptap/react` 根匯出點沒有這個元件，要從 `/menus`子路徑匯入，不是新增依賴，`@tiptap/extension-bubble-menu` 已經是 `@tiptap/react` 的既有 transitive dependency）；文字色只放常用的文字前景色（不含背景色，使用頻率低於前景色，仍只在右鍵選單/工具列提供）；註解／腳注按鈕分別遵守 `isFeatureEnabled("comment")`／`isFeatureEnabled("footnote")` 可見性開關。2026-08-16 依使用者要求把 Bubble Menu 從「常用行內樣式子集」擴充成含下標/上標/刪除線/腳注的完整行內操作集合；Claude 用 `npx vitest run` 確認 30 個測試不受影響，並在瀏覽器實測：選取文字後 bubble menu 正確顯示全部 10 個按鈕、點「腳注」正確開啟「加腳注」dialog、點「下標」正確 toggle mark（`editor.isActive('subscript')` 確認）
- [x] 跟右鍵選單共用同一份 command registry——沒有重新定義任何 command，`markCommands`／`textColorCommands`／`linkCommand`／`commentCommand` 都是從 `wysiwygCommandsByGroup`／`getWysiwygCommand` 取，UI 呈現（浮動小工具列 vs 右鍵選單列表）不同，但底層動作是同一份

### Phase 5：真表格（設計已定案，見上方「真表格最終設計」，本 Phase 是實作項目）

- [ ] 評估 Tiptap `TableKit`：schema、commands（新增/刪除列/欄）、cell selection、IME 在 cell 內的行為、paste 行為——2026-08-14 第一段實作先採用 `@tiptap/pm/tables` primitives + 自有 Tiptap table/tableRow/tableCell nodes，已接 schema 與基礎 row/column command；Claude/reviewer 已在 Playground 實測 Tab／Shift-Tab 與拖曳 CellSelection，核心 table editing 已驗證。IME／paste 完整測試步驟已整合進 Phase 9.1（表格 cell IME）／9.3（表格 cell 貼上），故本項維持未勾
- [x] 實作 `/table` 插入真正 table node（預設列/欄數可再定）——2026-08-14 Codex 已新增 command registry 的 `insert-table`，aliases 含 `表格`／`table`／`/table`，執行既有 `insertStorytellerTable({ rows: 3, cols: 3 })` 插入預設 3x3 真表格，並補 command test；Claude/reviewer 已跑 `npx vitest run` 確認通過
- [ ] cell 內支援基本行內樣式：粗體、斜體、底線、刪除線、文字色、連結、註解（腳注是否允許放 cell 內可另外評估）——2026-08-14 Codex 已補 `tableMarker.test.ts` 覆蓋 table cell 內粗體／斜體／底線／刪除線／文字色／連結／註解的 parser 支援，Claude/reviewer 已跑正式 `vitest` 確認 20 個測試全過；parser 層級已驗證，UI 層級（在真正的表格 cell 內實際套用這些樣式並確認 render 正確）改列進 Phase 8（純視覺/功能檢查，不是 IME，可以用瀏覽器自動化做，不需要移到 Phase 9），故本項維持未勾，等 Phase 8 執行後再更新
- [x] 表格的新增列/刪除列/新增欄/刪除欄操作入口：規劃放在表格內的右鍵選單或浮動控制項，這些入口是否齊全，直接影響 Phase 6 工具列移除的驗收——2026-08-14 Codex 已新增 `StorytellerWysiwygTableMenu.tsx`，游標在真表格內且非文字選取時顯示浮動操作列，提供上方/下方新增列、刪除列、左側/右側新增欄、刪除欄，直接呼叫既有 storytellerTable core commands；Claude/reviewer 已在 Playground 實測下方列／刪除列／右側欄／刪除欄與 Tab／Shift-Tab／CellSelection，確認 DOM row/column 數正確增減。2026-08-14 使用者回報兩個真表格缺陷，Claude 直接修正：①插入的表格完全沒有邊框，`StorytellerWysiwygEditor.tsx` 的 `BLOCK_KIND_SX` 原本沒有任何 `table`/`td` 樣式（跟閱讀頁 `StorytellerWysiwygMarkdown.tsx` 的 `BLOCK_GROUP_SX` 不一致），已補上同一套 border/padding 樣式，瀏覽器實測確認有內容跟空表格都能看到清楚的格線；②少了「刪除整張表格」的入口（只能刪列/刪欄），新增 `deleteStorytellerTable` core command 與浮動選單的「刪除表格」按鈕，處理表格是文件唯一內容時刪除會違反 `Document` schema（`block+` 不能空）的邊界情況，改補一個空段落而不是直接清空；瀏覽器實測過「表格+後面還有段落」與「表格是唯一內容」兩種情況都正確
- [x] 實作逐列一行 marker 的 parser／serializer（含 escape/unescape 規則）——已支援 `⟦table tableId="..." rowId="..."⟧| cell | cell |⟦/table⟧` 解析成 table node、相鄰同 `tableId` rows group 成同一張表、serializer 拆回逐列一行 marker；cell escape 規則已照定案處理 `\|`／`\\`／`\n`，並補 `tableMarker.test.ts` 覆蓋 round-trip 與欄數不一致補空 cell
- [x] 閱讀頁 renderer：把同 `tableId` 相鄰 row group 成真正 `<table>`——2026-08-14 Claude 補上 Phase -1 遺留的 Playground Reader preview pane（P2 待辦，直接掛 `StorytellerWysiwygMarkdown` 元件，見 `WysiwygDemo.tsx`），加了「真表格（Phase 5）」sample，在瀏覽器用 DOM 檢查確認：editor 跟 reader 各自都正確 render 出真正的 `<table><tbody><tr><td>`，`**完成**`／`--取消--` 分別產生 `<strong>`（`getComputedStyle` 確認 `font-weight: 700`）／`<s>`（確認 `text-decoration-line: line-through`），不是只有 code review／unit test
- [x] 匯出 markdown：輸出標準 markdown table——2026-08-14 已實作新 `⟦table⟧` 與舊 `table-row` 兩種表格的標準 markdown table 匯出，順便修掉一個既有 bug（舊 `table-row` 原本會匯出成錯誤的一般清單，不是表格）；Claude 用 `npx vitest run` 驗證過 `tableMarker.test.ts` 的兩個 export test case（新 table marker、舊 table-row）都通過，字串輸出精確比對過
- [x] 後端 word count／書籤 preview 對新 table marker 的 strip 邏輯——2026-08-14 已補 Go 端 table marker parser、cell split/unescape（`\|`／`\\`／`\n`）、wordCount、書籤 preview、搜尋 plain text strip，並補 `table_marker_test.go` 覆蓋 escape、圖片 alt、相鄰同 `tableId` 分組與缺失 `tableId` 不合併
- [x] `storytellerContentMarkerHint`／`storytellerContentSyntaxHint` 補上表格語法範例與規則說明，讓 AI agent 能透過 MCP 讀寫表格——2026-08-14 已明確寫入新 table marker 範例、同表 rows 必須相鄰、`tableId`／`rowId` 保持穩定、cell escape 規則，以及舊 `table-row` 只保留不新增
- [x] parser／reader 保護性 fallback：malformed row 不丟資料、無法 parse 退回純文字、`tableId` 缺失時的補救邏輯、row cell 數不一致時補空 cell——2026-08-14 Codex 已補 `tableMarker.test.ts` 測試 malformed table marker 退回純文字、缺 `tableId` 以 per-line fallback 避免 reader grouping 誤合併；row cell 數不一致補空 cell 先前已有測試。Codex 本地已跑 `tsc -b --noEmit`，並用 `tsc` emit parser/whitelist 到 `/private/tmp` 後以 Node smoke 驗證三個 fallback 行為；正式 `vitest` runner 仍因 sandbox 的 `SecItemCopyMatching failed -50` 失敗，需 Claude/reviewer 環境補跑
- [x] 舊 `table-row` 資料相容：parser 保留讀取能力，新增內容不再產生 `table-row`，提供手動「轉換成新表格」command，不靜默自動轉——2026-08-14 Codex 已移除新建入口（`| ` input rule、`block-kind-table-row` command、語法 drawer 內的舊表格列教學），舊資料 parser/reader/export 相容仍保留；已補 `convertLegacyTableRowsToStorytellerTable()` core command 與測試，會把游標所在的連續舊 `table-row` 段落轉成真表格、保留行內 mark、欄數不一致時補空 cell。Claude/reviewer 已跑 `npx vitest run` 確認通過
- [x] 移除或改接 `markerParagraph.ts` 既有的 `^\| $` input rule（目前會自動產生舊格式 `table-row` 段落），避免打 `| ` 仍能繞過「新增內容不再產生 table-row」的原則——2026-08-14 已移除 `| ` input rule，並同步移除 command registry 的 `block-kind-table-row` 與語法說明中的舊表格列範例
- [ ] 第一版明確不做：合併儲存格、調整欄寬、排序、公式、巢狀表格、cell-level bookmark、cell-level diff、貼上純文字 pipe table 自動辨識

### Phase 6：工具列移除（獨立、放最後、需驗收條件）

- [x] 驗收條件：slash command 已涵蓋所有區塊操作，含 Phase 5 的表格插入與表格內新增/刪除列欄操作——2026-08-16 Codex 逐一盤點過：標題／引用／清單／分隔線／插入表格都有 slash command；表格內新增/刪除列欄不是走 slash（設計上是游標進入表格後由 `StorytellerWysiwygTableMenu` 浮動選單提供，符合「不靠格式工具列」的精神，不要求每個操作都得是 slash 指令），Claude 核對過這個判斷合理，沒有發現缺口
- [x] 驗收條件：右鍵選單已涵蓋所有行內操作與區塊操作——2026-08-16 Codex 盤點發現工具列拔除前唯一明確缺口是段落對齊（`align-left`／`align-center`／`align-right`）只存在於格式工具列；已補進右鍵選單的「無選取」段落操作區（heading 與 block commands 之間）。Claude 用 `npx vitest run` 確認 30 個測試不受影響，並在瀏覽器實測：右鍵選單正確顯示置左/置中/置右三個選項，點「置中」後 `editor.getJSON()` 確認 `textAlign: "center"` 正確套用
- [ ] 驗收條件：中文 IME 在 Phase 0／Phase 3／Phase 5（表格內 IME）都已實測過，沒有已知問題——2026-08-16 使用者確認：這項排到最後，等他自己整體驗收時再做人工測試，不阻塞 Phase 6 其他項目先進行
- [x] 移除工具列（已定案完全拔除，不保留極簡求助 icon）——2026-08-16 已移除 `StorytellerWysiwygEditor.tsx` 內的格式工具列 `<Paper>` 區塊，並清掉工具列專用的色盤 anchor state／popover／高亮計算；文件層級 action 區保留語法說明、匯出 markdown、`toolbarExtra`。Claude 用 `npx tsc -b --noEmit`／`npx vitest run` 驗證過（30 個測試全過），並在瀏覽器完整實測：畫面確認格式工具列完全消失，只剩右上角的文件層級 action 區；粗體透過 Bubble Menu 正確套用；文字背景色（Bubble Menu 沒有的項目）透過右鍵選單正確套用；全程無 console error。過程中一度在同一個 dev server tab 上看到 `Select is not defined`／`DEFAULT_HEADING_LEVEL is not defined` 之類的 ReferenceError，重開一個全新的 dev server + tab 後完全消失，判斷是 Codex 編輯過程中 Vite HMR 沒接住大量刪除程式碼造成的暫時性殘留狀態，不是真正的程式碼問題（`tsc -b --noEmit` 本來就不可能讓這些符號通過編譯卻在執行期找不到，只有 HMR 增量更新沒有正確重載才會這樣）
- [x] 工具列移除後的初次使用引導：游標所在的空白段落顯示低調 placeholder「輸入 / 插入區塊；選取文字可套用樣式」，段落有文字或圖片等 inline content 時自動消失，不影響 Reader，也不能出現在文件裡所有空白行上——2026-08-16 用 editor-only ProseMirror decoration 實作；使用者實測發現初版會掃整份文件所有空段落造成提示文字滿版（這個 app 大量用空白行當敘事留白，比一般 Notion 文件更容易踩到），已修正為只對 collapsed selection 目前所在的空段落加 decoration。Claude 用 `npx tsc -b --noEmit`／`npx vitest run` 驗證過（30 個測試全過），並在瀏覽器重現使用者回報的情境（3 句對話中間各夾一個空白行）：修正前會 6 個段落全部冒出提示文字，修正後用 DOM 查詢確認同時只有 1 個 `.wysiwyg-empty-paragraph` 元素、且正是游標所在那一行；游標移到其他空白行會跟著換、移到有文字的段落則完全不顯示；全程無 console error
- [x] 幫 `StorytellerWysiwygSyntaxDrawer`（語法說明側欄）找一個不屬於工具列的新入口——2026-08-16 Codex 已新增編輯器右上角的文件層級 action 區，承接語法說明、匯出 markdown、以及原本 `toolbarExtra` 插槽（插入資產／AI Agent／編輯歷史）；格式工具列內原本的 utility／syntax／toolbarExtra 入口已移出，後續同輪 Codex 也已移除格式工具列本體。Claude 在瀏覽器實測：新的右上角 action 區正確顯示、點語法說明圖示正確開啟 drawer（且文案已同步更新成「透過選單套用」，不再提「工具列」），DOM 確認 `[aria-label="支援的語法"]` 只有 1 個（沒有跟格式工具列重複），`toolbarExtra` prop 介面完全沒變（`StoryEditor.tsx`／`LoreEditor.tsx` 呼叫端不用改），只是 render 位置從格式工具列尾端搬到新的 action 區
- [ ] StoryEditor／LoreEditor 實測：autosave、字數、AI agent 附加、匯出 markdown 不受影響——2026-08-16 這項需要真實登入帳號＋真實 story/lore API 操作，Claude/Codex 的環境都沒有這個條件，不去借用使用者的登入 session。改用程式碼審查型驗收：`git diff` 確認整個 Phase 6（108f2ff..6e1af0e）`StoryEditor.tsx`／`LoreEditor.tsx` 完全零改動；`StorytellerWysiwygEditorHandle`／`useImperativeHandle`（`insertAsset` method）介面沒變；`toolbarExtra` prop 仍有 render，只是位置搬到右上角文件層級 action 區；autosave／字數／AI agent 附加這些邏輯都是頁面層自己的 `useEffect`／API 呼叫，跟被拔掉的格式工具列 JSX 完全獨立，程式碼審查沒有發現風險。完整人工測試步驟已整合進 Phase 9.2，不現在打勾

### Phase 7：圖片版面控制（Track B／Codex 負責，排在 Phase 5 真表格完成之後）

2026-08-13 使用者提出的新需求：資產圖片目前編輯器跟閱讀頁都強制 `width:100%`／`display:block`，沒有靠左/靠右/置中的「文繞圖」（圖片浮動、文字環繞）效果。跟 Claude／Codex 在同一 Codex CLI session 討論後定案，指派給 Track B（Codex），排在 Phase 5 真表格完成之後（表格是資料模型層級的大改動，優先權更高，不要互相搶時間）。

**設計要點（已定案，不是待討論事項）**：

- **不重用段落既有的文字 `align` 屬性**：`align` 預設值就是 `"left"`，若把圖片段落的 `align="left"` 直接解讀成 float-left，所有既有圖片會從目前的 full-width block 靜默變成左浮動窄圖，是破壞性變更。改成在 `assetImage` 節點自己新增獨立的 `layout` 屬性（`block` / `center` / `float-left` / `float-right`），沒有 `layout` 的舊圖片一律當 `block`，行為完全不變，不需要遷移。
- **寬度第一版固定比例，不做拖曳調整**：`block` 全寬；`center` 約 `min(80%, 720px)` 置中；`float-left`／`float-right` 約 `min(45%, 360px)`；手機螢幕（小於某個 breakpoint）一律退回 `block` 不浮動。拖曳調整寬度另開後續需求，不在第一版範圍。
- **float 清除規則**：一般段落文字可以環繞在浮動圖片旁邊；標題、引用、清單、分隔線、表格、下一張圖片預設要 `clear: both`，避免版面疊在一起。編輯器跟閱讀頁要套同一套規則，確保編輯時看到的畫面跟讀者看到的一致。
- **操作入口是圖片專屬的 layout command，不是複用 Phase 1 的文字對齊 command**（`align-left`/`align-center`/`align-right` 語意是文字對齊，跟圖片的 float 語意不同，混用會混淆）；入口先接右鍵選單（游標/selection 在圖片 node 上時顯示）或之後的 Bubble Menu。
- **匯出 markdown 第一版直接退化**：標準 markdown 沒有文繞圖語法，匯出時全部輸出成一般靠左圖片，不勉強保留浮動效果。

**Checklist**：

- [x] `assetImageNode.tsx` 的 `assetImage` 節點新增 `layout` 屬性（`block`/`center`/`float-left`/`float-right`，預設 `block`）——2026-08-16 已新增 layout 白名單與 node attr，舊資料預設 `block`；Claude/reviewer 跑 `npx vitest run` 確認通過
- [x] 編輯器 NodeView（`AssetImageView`）依 `layout` 套用對應 CSS（float+固定寬度 vs block+置中/全寬），手機退回 `block`——2026-08-16 已抽出共用 `assetImageFrameSx()` 並套進 editor NodeView；Claude 用瀏覽器對四種 layout 都做過 `getComputedStyle` 驗證：float-left（`float:left`／`width:360px`）、center（`display:block`／`width:720px`／等寬 auto margin 置中）、float-right（`float:right`／`width:360px`／`margin-left:16px`）都正確；另外在 375px 寬（mobile preset）驗證退回 `float:none`、寬度縮成貼近容器全寬，符合手機斷點退回 block 的設計
- [x] 閱讀頁 `StorytellerWysiwygMarkdown.tsx` 的圖片 render 邏輯同步支援 `layout`，跟編輯器套同一套寬度/breakpoint 規則——2026-08-16 已接同一套 `assetImageFrameSx()`；Claude 用 Playground 的 raw content textarea 輸入含 `"layout=float-left"` title 的真實 markdown 語法（不是繞過 parser 直接建 doc），確認 Reader pane 也正確 render 出 `float: left`，跟編輯器一致
- [x] 非 paragraph block（標題／引用／清單／分隔線／表格／下一張圖片）預設 `clear: both`，編輯器與閱讀頁都要套用——2026-08-16 已新增共用 `CLEAR_FLOATING_ASSET_SX` 並套進 editor/reader；Claude 確認編輯器與 Reader 的 `<h1>` 元素（標題在這個扁平 schema 裡實際上是渲染成真正的 `<h1>`~`<h6>`，不是 `<p>`）都拿到 `clear: both`，浮動圖片後面接的標題正確被推到浮動圖片下方，不會疊在一起
- [x] 圖片專屬的 layout command 加進 `wysiwygCore/commands.ts`（新 group，例如 `image-layout`），right-click 選單在游標/selection 落在圖片 node 上時顯示這組 command——2026-08-16 已新增 `image-layout` command group（全寬／置中／靠左環繞／靠右環繞），右鍵點到 asset image DOM 時會轉成 `NodeSelection` 並顯示圖片專屬選單。過程中一輪 review 抓到真實 bug：右鍵選單原本會把既有 annotationCommands（加連結/加腳注/加註解）一起顯示在圖片選單下方，因為那組 cross-cutting 區塊只看 `hasSelection`（NodeSelection 永遠非 empty），實測點「加連結」後 `assetImage` node 真的被加上 `marks:[{type:"link"}]`——語意錯誤且會在存檔時被 serializer 靜默丟掉，已請 Codex 修正（annotationCommands 的 filter 加 `!hasAssetImage`）。修好後使用者又提出圖片操作入口分裂的 UX 疑慮（鉛筆 icon 只有 alt text、右鍵只有 layout，兩邊都看不到對方有什麼功能），跟 Codex 討論定案：鉛筆／雙擊開啟的 dialog 升級成「圖片設定」（替代文字＋版面下拉選單＋刪除圖片按鈕），右鍵選單補上「圖片設定」（用 CustomEvent 讓 context menu 觸發 NodeView 內的 dialog）「刪除圖片」再接 4 個 layout quick action。Claude 已在瀏覽器完整測過：右鍵選單不再混入加連結/加腳注/加註解；右鍵「圖片設定」正確開啟 dialog 且欄位反映當前 layout；dialog 內切換版面後 `getComputedStyle` 確認四種 layout（block/center/float-left/float-right）都套用正確 CSS；右鍵「刪除圖片」正確移除 node（`editor.getJSON()` 確認）；dialog 內「刪除圖片」按鈕效果相同
- [x] 序列化：`layout` 屬性寫進 `⟦⟧` 段落 marker 或圖片自身語法（實作前需定案存放位置，避免跟既有 `align` 屬性混淆）——2026-08-16 定案採圖片自身 markdown title：非 `block` 輸出 `![alt](steamloom-asset://id "layout=float-left")`，`block` 省略 title 維持舊格式；Claude 跑 `npx vitest run` 確認 parser/serializer round-trip 測試通過（過程中抓到一個測試斷言錯誤：匯出單一 block 的既有慣例是結尾一個 `\n`，不是 `\n\n`，已請 Codex 修正）
- [x] 匯出 markdown：圖片一律退化輸出成無浮動效果的一般圖片語法——2026-08-16 已補 export test，確認 layout title 不出現在匯出 markdown；Claude 用 `npx vitest run` 驗證通過
- [x] 舊資料相容：沒有 `layout` 屬性的既有圖片維持 `block` 全寬，行為不變，不需要遷移——2026-08-16 已補舊圖片 parse/serialize 測試；Claude 用 `npx vitest run` 驗證通過，另外在 Playground 用「基本語法」sample 的既有圖片確認畫面沒有變化（仍是 `display: block`、全寬）
- [x] 人工瀏覽器實測：三種 layout 在編輯器與閱讀頁的視覺效果、float 後接標題/引用/表格等 block 的 clear 效果、手機斷點退回 block——2026-08-16 Claude 已用瀏覽器自動化補完剩餘驗證：center（`getComputedStyle` 確認 `display:block`／`width:720px`／等寬 margin 置中）、float-right（透過「圖片設定」dialog 切換，確認 `float:right`／`width:360px`／`margin-left:16px`，並用截圖確認文字正確環繞在圖片左側）、手機斷點（resize 到 375px 寬，確認 `float:none`、寬度貼近容器全寬）；float-left／標題 clear 效果／Reader 一致性已在前一段驗證過。四種 layout 加上手機斷點都已完整覆蓋

### Phase 8：自動化／程式可驗證收尾（不需要使用者操作）

2026-08-16 使用者要求把「驗證與收尾」拆成兩塊：Claude/Codex 能繼續用程式或瀏覽器自動化完成的項目留在 Phase 8；真的只能靠人工才能驗證的項目移到新增的 Phase 9，並附完整測試步驟。以下是重新分類、改寫過的 Phase 8——每一項都應該由 Claude 或 Codex 自己完成，不需要使用者操作或提供真實帳號。

- [x] 表格 cell 內行內樣式的 UI 層級驗證：在真表格 cell 內套用粗體／斜體／底線／刪除線／文字色／連結／註解，瀏覽器 `getComputedStyle`／DOM 確認 render 正確（parser 層級已在 Phase 5 驗證過，這項補的是「UI 操作＋畫面呈現」，不是 IME）——2026-08-16 Codex 先在 `tableMarker.test.ts` 補了 jsdom 層級測試（他這輪 sandbox 沒有瀏覽器可用），套用 bold/italic/underline/strike/textColor/link/comment 在表格 cell 內，確認 DOM（`strong`/`em`/`u`/`s`/`.wysiwyg-textcolor-red`/`a.wysiwyg-link`/`.wysiwyg-has-comment`）與序列化 markdown 都正確；Claude 用瀏覽器自動化補上真實 `getComputedStyle` 驗證（直接用 `editor.commands.setContent()` 建構含 bold/italic/strike/link 的 `storytellerTable` doc node），確認 `fontWeight:"700"`、`fontStyle:"italic"`、`textDecorationLine:"line-through"`、連結 href 與顏色都正確，console 無新增錯誤
- [x] Reader 實測（DOM/CSS 層級）：標題、引用、清單、真表格、腳注、圖片文繞圖，透過 Playground 的 Reader preview pane 用瀏覽器自動化逐項確認 render 正確——2026-08-16 Claude 用「基本語法」與「真表格（Phase 5）」兩個 sample 確認：標題 `h2`、引用 `blockquote`（1 個）、清單 `ul`/`ol` 都有渲染、腳注連結與錨點 `href` 正確配對（`#_r_4_fn-note-...` / `#_r_4_fn-anchor-...`）、真表格在 Reader 端渲染出 `<table>`（3 rows / 9 cells，`display:table`／`border-collapse:collapse`）且內容與編輯器一致、粗體/斜體/文字色/註解的 inline mark 都有對應 DOM（`strong`/`em`/color/`comment` class）。書籤高亮邏輯確認是前端邏輯（`Reader.tsx` 的 `bookmark-line-{lineIndex}`／`storyHeadingAnchorId`），但需要真實帳號的書籤資料才能觸發，Playground 沒有登入也沒接真實 API 測不到，已移到 Phase 9.2 由使用者用真實帳號測
- [x] Diff 邏輯補 Vitest（不是 Go 後端測試——diff 是前端邏輯，主要在 `components/common/customDiff.ts` 的 `buildCustomLineDiff()` 與 `wysiwygCore/parser.ts` 的 `stripMarkerForDiffContent()`／`stripMarkerForDiffLine()`，`StoryVersionDiff.tsx`／`StoryDiffCompare.tsx`／`LoreDiffCompare.tsx`／`StorytellerVersionCompareDialog.tsx` 都是消費端）——2026-08-16 全部完成，新增 `lineDiff.test.ts`（7 個測試）＋ Codex 的 `tableDiff.test.ts`（2 個測試），`npx tsc -b --noEmit` 乾淨、`npx vitest run` 40/40 通過：
  - [x] `markerId` 改變不應造成 diff
  - [x] `align`／文字色／背景色／註解屬性改變不應造成本文 diff（只是樣式變了，文字沒變）
  - [x] `--刪除線--` 內容變更應該造成 diff，但 delimiter 本身（`--`）不應該製造假差異
  - [x] 新 table marker 逐列 diff：改某一列的 cell 內容，只應該影響那一行的 diff，不牽動其他列——2026-08-16 Codex 新增 `tableDiff.test.ts`，用 `buildCustomLineDiff()` 驗證通過
  - [x] `tableId`／`rowId` 改變但 cell 文字沒變，不應造成 diff——2026-08-16 同上，`tableDiff.test.ts` 已覆蓋
  - [x] footnote 內容進 footnote diff 區塊，不該混進本文 diff——2026-08-16 確認 `StoryVersionDiff.tsx` 用 `extractFootnoteNotesForDiff()` 把腳注抽成獨立區塊、跑自己的 `buildCustomLineDiff()`；`lineDiff.test.ts` 驗證 footnote note 內容改變本文 diff 看不到差異、但 `extractFootnoteNotesForDiff()` 抽出的獨立 diff 能正確看到差異
- [x] Mobile CSS/breakpoint 自動化：resize_window 模擬手機寬度，程式化確認 bubble menu／slash command 在窄螢幕下仍能觸發並正常運作、圖片 layout 正確退回 block（圖片部分已在 Phase 7 驗證過）——2026-08-16 Claude 驗證：整體版面在 375px 寬度正確收窄成單欄（確認過標題／段落／清單／圖片區塊都沒有橫向溢出或跑版）；區塊命令選單（右鍵/`/`／點空白段落觸發的那個，含標題/對齊/引用/清單/分隔線）在 375px 下完整可讀、無截斷；bubble menu 10 個按鈕全部量過 `getBoundingClientRect`，最後一顆「註解」右緣在 x=356，在 375px 視窗內沒有溢出——**過程中發現一個瀏覽器自動化測試工具本身的限制，不是產品 bug**：在 mobile 模擬模式下用 `computer` 工具的 click/double_click/triple_click 點文字，會被這個工具的 mouse-to-touch 轉譯成類似 `contextmenu` 事件，直接跳出區塊命令選單、蓋掉正常的「點擊放游標」行為，導致沒辦法用點擊在窄螢幕下框選文字；改用「先在桌面寬度框選文字觸發 bubble menu，再 resize 到手機寬度」的方式繞過去做版面驗證。這個工具限制本身很接近使用者實際會遇到的疑問（手機上點一下文字到底是選字還是跳選單），因此已經在 Phase 9.4「Mobile 真實裝置觸控體感」註記提醒優先確認這一點
- [ ] MCP 實測：透過 `storyteller_upsert_story`／`storyteller_upsert_lore` 這類 MCP tool 直接寫入一次含真表格的內容，確認 `storytellerContentSyntaxHint`／`storytellerContentMarkerHint` 的說明足夠讓 AI agent 手寫出合法的 table marker、寫入後能被前端正確 parse／render——2026-08-16 **目前被部署狀態卡住，還不能測**：Claude 用 `ToolSearch` 查過目前實際連線的 `storyteller_upsert_story` MCP tool，發現它的參數說明還是舊版（`each row is its own line: |cell1|cell2|cell3` 那種舊 table-row 語法），代表 Phase 5 的 table marker MCP hint 更新（`service/mcp/storyteller_tools.go`）跟後端 parser 改動都只存在於 `codex/storyteller-wysiwyg-analysis` branch，還沒 merge 進 `main`、也還沒部署，Claude/Codex 都沒有部署權限。現在用真實 MCP tool 測只會測到舊版後端，結果沒有代表性，容易誤判成「沒問題」；這項要等 branch 部署後才能真正測，先維持未勾、標記為卡在部署依賴
- [x] StoryEditor／LoreEditor 程式碼審查型驗收——2026-08-16 已在 Phase 6 完成：確認 `toolbarExtra`／`useImperativeHandle` 介面沒變、`StoryEditor.tsx`／`LoreEditor.tsx` 整個 Phase 6 期間零改動；真實頁面的人工操作驗收見 Phase 9

### Phase 8.1：待接續處理項目（功能面，這次只列項目不實作）

2026-08-17 新增。Faryne 完成 Phase 9.2／9.3 人工驗收後，提出四個功能面的問題（不是 bug，是「這個功能現況合不合理／要不要做」的產品判斷），Claude／Codex 討論收斂如下。**這個 Phase 目前只記錄要做什麼、怎麼做、風險是什麼，不實作**，等 Faryne 排時間才動工，跟 Phase 8.1 之前的所有 Phase 不一樣（那些是驗證/收尾，這裡是新功能規劃）。

Claude／Codex 建議的施作順序（跟項目編號無關）：**1 匯出格式契約 → 4 表格 cell soft break → 2 圖片尺寸 preset → 3 表格欄寬**。理由：1 是使用者對「匯出」這個功能名稱的期待跟實際結果不一致，屬於語意問題；4 是使用者在 Phase 9.3 實測時已經真的踩到（貼上多行文字全部擠成一行、手動 Enter 也無法換行），屬於已知的資料處理瑕疵；2、3 則是體驗強化，優先度較低。

#### 8.1.1 匯出格式契約重整

- **現況問題**：「匯出 markdown」功能名稱暗示「匯出後打開就能看到跟網頁一樣的東西」，但實際上內容含圖片時，圖片網址是內部專用的 `steamloom-asset://{publicId}` scheme（[exportMarkdown.ts:119](../../static_site/src/pages/storyteller/wysiwygCore/exportMarkdown.ts#L119)），不是任何標準 markdown 檢視器認得的 URL，下載後打開圖片一定是壞掉的（找不到圖片）。
- **不建議**：直接拿掉「匯出 markdown」——它仍有價值：純文字備份、丟給 AI 用、版本留存、搬到其他工具後再手動整理圖片。問題不在於這個功能沒用，是它被包裝成「完整視覺匯出」但做不到。
- **建議方向**：拆成兩個語意清楚的功能，不要混在一起：
  - 「匯出 Markdown」：定位成文字/結構匯出，圖片是內部連結這件事要讓使用者知道（例如匯出按鈕旁註明，或圖片替代文字提示這是內部資產連結）。
  - 「匯出可閱讀檔案」：目標是打開就看得到圖片，跟網頁呈現效果一致。評估三個方案：
    - **Markdown + assets ZIP**（成本最低）：把用到的圖片一起下載，images 資料夾放圖片，markdown 內的圖片連結改成相對路徑（`assets/xxx.png`）。第一階段建議做這個。
    - **HTML + ZIP**：比 markdown 更貼近網頁呈現效果（可以保留顏色/底線/表格樣式），成本比 markdown+zip 高一些但比 PDF低。
    - **PDF**：視覺一致性最強（跟網頁「長一樣」的訴求最直接），但成本最高——字體嵌入、分頁、浮動圖片版面在紙本分頁情境下怎麼處理、表格跨頁、腳注位置，都要重新設計，不是簡單加一個轉檔套件就好。排在最後評估，不是第一階段目標。
- **風險／成本**：三個方案都需要後端或前端產生 ZIP／PDF（目前完全沒有這類基礎設施）；圖片打包需要考慮圖片授權/大小（大量圖片的故事匯出檔可能很大）；PDF 方案的成本明顯高於前兩者，建議先評估 markdown+zip 是否已經滿足大部分需求，PDF 排在確認有需求後再做。

#### 8.1.2 表格 cell 內軟斷行（soft break）／多行貼上

- **現況問題**：Phase 9.3 實測發現，貼上多行文字（或試算表多個相鄰儲存格）到表格 cell 內，全部內容會被擠成一行；使用者手動按 Enter 也沒辦法在 cell 內建立新的一行。
- **Root cause**（非 bug，是既有 schema 設計的直接結果）：`StorytellerTableCell` 的 `content` 是 `"inline*"`（[storytellerTable.ts:346](../../static_site/src/pages/storyteller/wysiwygCore/storytellerTable.ts#L346)），只能放行內內容，不能放 `paragraph` 這種 block 節點——這是刻意維持「一行＝一個段落」這個貫穿全專案的不變量（表格 cell 本身就不是一個 paragraph，不該讓它變成能放多個 paragraph 的容器，否則書籤/diff 的 line-based 模型會被打破）。
- **建議方向（折衷方案）**：導入 Tiptap 的 `HardBreak`（對應 `<br>`）——這是 inline 節點，不违反 `content:"inline*"` schema，也不會讓 cell 變成能放多個段落。具體：
  - `Shift+Enter` 在 cell 內插入 hard break（一般段落如果也想要這個行為可以一併評估，但這次範圍先限定在表格 cell）
  - 貼上多行文字／試算表多列到 cell 內時，轉成 hard break 而不是壓成一行純文字
  - Serializer 把 hard break 輸出成 `\n`（呼應既有的 cell escape 規則裡本來就保留給換行用的字元，設計上是接得上的，不是新加一套規則）
  - Parser 看到 cell 內容裡的 `\n` 還原成 hard break
  - Markdown 匯出：cell 內的 hard break 輸出成 `<br>`（GFM table 慣例）
- **風險**：
  - 全域 `handlePaste`（[StorytellerWysiwygEditor.tsx](../../static_site/src/pages/storyteller/StorytellerWysiwygEditor.tsx)）原本是為一般段落設計的貼上邏輯，要避免在表格 cell 內誤用一般段落的拆段邏輯（例如錯誤觸發 `splitParagraphFresh()`）
  - Diff 的 strip 邏輯（`stripMarkerForDiffLine()` 等）要把 hard break 轉成人類看得懂的呈現，不然 diff 畫面可能看不出差異在哪
  - Reader 端的表格 cell render 要正確處理 `<br>`
  - MCP 的 `storytellerContentSyntaxHint` 要補充說明：cell 內想要換行要用 `\n`

#### 8.1.3 插入圖片尺寸調整 ✅ 已實作（2026-08-17）

- **現況問題**：插入的圖片完全沒有尺寸調整功能——`assetImageNode.tsx` 目前的 width 設定是寫死的（block 版面 `100%`，float 版面固定 360px，見 Phase 7 記錄），使用者沒有任何手動調整圖片尺寸的入口。
- **建議方向**：第一版不做拖曳 resize（會牽涉 NodeView、selection、mobile、儲存格式、undo/redo，成本不小），改成在既有「圖片設定」dialog 裡加尺寸選項（例如 `原尺寸／大／中／小`，或百分比選項，float 圖跟 block 圖可能需要不同的選項區間）。
- **儲存格式**：延續 Phase 7 已經在用的 image title metadata 模式（例如目前已有 `layout=float-left`），加一個 `size=medium` 這類語意化欄位——不建議一開始就存 pixel 數值，語意化的 preset（small/medium/large）在響應式排版跟不同閱讀容器寬度下比較好處理，不用另外處理「這個 pixel 數字在手機上還合理嗎」的問題。
- **風險**：Reader／編輯器／匯出三邊都要吃到同一個 size 設定並保持行為一致；float 圖尺寸選太大會壓縮文字欄寬，需要有上限；mobile 斷點仍然要強制退回合理寬度（不能讓使用者選的 size 在手機上把版面撐爆）；markdown 匯出沒有標準的圖片尺寸語法，可能只能退化忽略尺寸、或改用 HTML `<img>` tag（這點會跟 8.1.1 的匯出格式重整互相影響，兩者可能需要一起考慮）。
- **實作結果**：如規劃所述，在「圖片設定」dialog 加了「尺寸」下拉（小／中／大，預設「大」跟改動前的唯一行為完全一樣，舊資料不用遷移）：
  - `whitelist.ts` 新增 `ASSET_IMAGE_SIZE_VALUES`／`normalizeAssetImageSize`／`assetImageSizeFromTitle`，title 格式從單一 `layout=xxx` 擴充成可以同時帶 `layout=xxx size=yyy`（順序不拘、缺一個就用預設值，向下相容）
  - `assetImageLayout.ts` 新增 `assetImageTitle(layout, size)`（取代原本的 `assetImageLayoutTitle`）跟三組 layout 各自的 size 換算表（block: 40%/70%/100%，center: min(40%,360px)/min(60%,540px)/min(80%,720px)，float: min(25%,220px)/min(35%,300px)/min(45%,360px)——large 完全沿用 Phase 7 原本寫死的數字，不是重新設計）；mobile 斷點沿用既有規則，一律強制全寬，size 只影響桌面/平板
  - `assetImageNode.tsx`（編輯器）／`StorytellerWysiwygMarkdown.tsx`（Reader）都改用同一份 `assetImageFrameSx(layout, size)`，兩邊視覺保持一致
  - `parser.ts`／`serializer.ts` 同步支援 `assetSize`／`size` 欄位的解析與序列化
  - 驗證：`assetImageLayout.test.ts` 新增 4 個測試（含「舊圖片沒有 size 時預設 large、行為/寬度完全不變」的向下相容測試），`npx vitest run` 43/43 通過（原 40 + 新增 3）；`npx tsc -b --noEmit` 乾淨；瀏覽器實測：圖片設定 dialog 選「靠左環繞＋小」，確認實際寬度變成 `220px`（對應 `min(25%,220px)`）、Reader 端同步顯示同樣寬度、raw markdown 正確輸出 `"layout=float-left size=small"`

#### 8.1.4 表格欄寬（column width）調整 ⚠️ 第一階段已實作（2026-08-17），第二階段（手動 resize）未做

- **現況問題**：延續「已知 Bug 記錄」第 6 項——表格目前用瀏覽器預設的 `table-layout: auto`，完全沒有欄寬管理機制，這不只是組字時會抖動的美觀問題，也代表使用者沒有任何辦法讓某一欄變寬/變窄。
- **建議方向（分兩階段，第一階段先解決穩定性，不是完整功能）**：
  - **第一階段**：不做拖曳，先改成更穩定的欄寬策略（例如切到接近 `table-layout: fixed` 但要搭配平均欄寬或依內容比例分配的邏輯、cell 內容 overflow/wrap 的處理），目的是先消除組字抖動，不追求「使用者可以手動調整」。
  - **第二階段**：真正的手動 column resize——需要研究 `prosemirror-tables` 套件本身附的 `columnResizing` plugin 能不能直接套用、table cell schema 需要支援 `colwidth` 屬性。
- **儲存格式是這個功能最關鍵的設計問題**：目前真表格是「逐列一行 marker」格式（`⟦table tableId rowId⟧| ... |⟦/table⟧`），欄寬理論上是「整張表格」的屬性，不是「某一列」的屬性，所以不能每一列各自存一份欄寬（會有多份資料互相打架、以誰為準的問題）。可能的做法是規定「只有第一列（或某個固定角色的列）帶欄寬 metadata，其他列的欄寬欄位留空／忽略」，但這會讓 `serializer`／`parser`／diff／MCP hint 全部要跟著更新，不是一個小改動。**這個儲存格式問題在第二階段（手動 resize）才會碰到，第一階段完全不需要處理**，第一階段沒有任何欄寬資料要存。
- **列高**：建議先不做。列高通常可以靠內容自然撐開，文字編輯器情境下手動調列高的需求本來就弱，硬做只會增加 mobile／Reader／匯出的複雜度，先不排進第一版，除非之後有明確的使用需求再評估。
- **第一階段實作結果**：2026-08-17 Faryne 確認範圍只做第一階段（穩定/防抖動），不含手動 resize。改動：編輯器（`StorytellerWysiwygEditor.tsx`）跟 Reader（`StorytellerWysiwygMarkdown.tsx`）的表格 CSS 都加上 `table-layout: fixed`（原本沒設定，預設是 `auto`）＋ `td`/`th` 補 `word-break: break-word`（fixed 之後欄寬不會再依內容撐開，長字串需要明講才會正確換行不撐破欄寬）。**副作用（刻意接受，不是 bug）**：沒有指定任何欄寬資訊時，瀏覽器在 `table-layout:fixed` 下會把可用寬度平均分配給每一欄，所以原本「內容窄的欄自然比較窄」（例如範例表格「狀態」欄）的效果會消失，變成所有欄等寬——這是「先求穩定，不做手動調整」這個範圍下無法避免的取捨，等第二階段做手動 resize 時使用者才能自己調回想要的比例。驗證：瀏覽器實測在真表格 cell 內用 `insertText` 塞入長字串，確認欄寬（`getBoundingClientRect().width`）改動前後完全不變（原本會抖動變寬，現在維持一致）；`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過（這項純 CSS 改動沒有新增對應的 vitest 案例，用瀏覽器直接驗證欄寬數值）。

### Phase 9：人工驗收案例（無法自動化，需要使用者親自操作）

2026-08-16 新增，2026-08-16 補上 checklist 方便逐項勾稽。以下每一項都是 Claude／Codex 已確認無法透過程式或瀏覽器自動化驗證的項目（原因見各項說明），需要使用者用真實鍵盤/輸入法/帳號/裝置親自操作一次。每個測試案例都寫成「照著做、看結果符不符合預期」的具體步驟，不需要自己想怎麼測。測完可以直接回報「哪幾項過、哪幾項有問題」，不用整份都測完才回報，發現問題可以隨時反饋，不用等全部做完。

原本散落在 Phase 0／3／5／6 裡、需要人工才能驗證的未打勾項目，已全部整合進本 Phase，原本的位置只留一句話指到這裡，不重複敘述。

- [ ] **9.1 中文 IME 組字測試**（風險最高，建議優先測；對應 Phase 0／3／5／6 裡標記為「人工實測中文 IME」的所有項目）
- [ ] **9.2 StoryEditor／LoreEditor 真實頁面操作**（對應 Phase 6「StoryEditor／LoreEditor 實測」）
- [ ] **9.3 表格 cell 貼上（paste）行為**（對應 Phase 5「TableKit 的 paste 行為」）
- [ ] **9.4 Mobile 真實裝置觸控體感**
- [ ] **9.5 長篇寫作體感**（Placeholder／Slash／Bubble Menu／右鍵選單綜合）
- [ ] **9.6 圖片文繞圖真實閱讀體感**

#### 9.1 中文 IME 組字測試

**為什麼不能自動化**：瀏覽器自動化工具只能模擬「已經打完字」的按鍵輸入，沒辦法模擬「注音/拼音組字中途」的真實輸入法狀態（例如打到一半、還沒選字、候選字視窗開著的那個狀態）。這個編輯器有好幾處會即時攔截使用者輸入（自動轉換符號、`/` 觸發選單），這些攔截邏輯有沒有誤判組字中的按鍵，只有真人用真的輸入法才測得出來。

**測試環境**：在 Playground（`/storyteller/wysiwyg-demo`，選「空白」樣本）或任一 Story/Lore 編輯頁面都可以測，用你平常慣用的注音或拼音輸入法。

**案例 1：符號自動轉換不誤判組字中的按鍵**
- [x] 在編輯器空白處，開始用注音/拼音打一段中文字（例如打「測試」，但先不要按 Enter/空白選字，讓候選字視窗保持開著）
- [x] 在候選字視窗開著、還沒選字完成的狀態下，按看看數字鍵/符號鍵切換候選字，確認畫面沒有誤觸發任何自動轉換（例如不會突然冒出粗體/刪除線效果）
- [x] 完成選字後，實際打 `**文字**` 確認變粗體  => 毫無反應，變成 `**文字**`
- [x] 打 `*文字*` 確認變斜體
- [x] 打 `++文字++` 確認變底線
- [x] 打 `~文字~` 確認變下標
- [x] 打 `^文字^` 確認變上標
- [x] 打 `--文字--` 確認變刪除線
- [x] 獨立一行打 `---` 確認變成分隔線
- [x] 確認以上符號如果是在中文組字「中途」按到（例如打注音候選字時剛好選到某個符號），不會誤觸發格式轉換；組字完成、符號是你真的要打的那幾個字元時才應該轉換
- [x] 記錄結果：中文輸入、候選字是否正常運作；符號是否只有在真正打完整組、且不是組字中途時才轉換成對應格式（如果有任何一種符號沒有按預期轉換、或誤在組字中途轉換，記錄下用的是哪種輸入法、打了什麼、發生了什麼）

**2026-08-16 備注（Faryne 回報 + Claude 查證）**：Faryne 實測發現「先打 `*文字` 再補上結尾 `*` 會成功轉換；但若先打 `文字*`、再回頭在前面補開頭 `*` 則不會轉換」。Claude 查證後確認：這是 ProseMirror InputRule 機制本身的設計限制，不是這個編輯器寫錯——`markInputRule` 只會在輸入當下往回看游標前面的文字比對正則，永遠要求「結尾符號是剛打的最後一個字」才會觸發，這跟 Notion／Typora／Obsidian 這類即時 markdown 編輯器的行為一致（都只支援由左到右、結尾符號最後打）。

Claude 用瀏覽器自動化逐字元測試過（`**bold**`／`**測試文字**`／`~BB~` 等多組案例，包含同一行連續操作、不換行不重載去重現 Faryne 的操作方式），確認：
- 逐字打的情況下，`**文字**`／`~文字~` 等符號組合都能正確轉換成對應格式，沒有重現「毫無反應」的狀況；Faryne 原本記錄的「`**文字**` 毫無反應」，Claude 懷疑是打字當下有一次性貼上或批次輸入的情形，而不是逐字打字本身的問題（見下一點）
- 往回補開頭符號（例如已有 `BB~`，再回到行首補 `~` 變成 `~BB~`）確實不會觸發轉換，但也不會 crash、不會弄亂文字，只是維持字面符號——這點跟 Faryne 記錄的行為一致，是預期內的限制
- 查證過程中另外找到一個真的會 crash 的情況（`RangeError: Position 3 out of range`），但只有在「整段文字一次性塞入」（例如貼上、或自動化工具一口氣塞入一整串字元，不是逐字打）時才會出現，逐字打不會觸發；這是一個獨立的問題，跟這個案例本身不是同一件事，先記錄在此，之後如果要查可以從 `markInputRules.ts` 的 `handler` 邏輯跟 `prosemirror-inputrules` 套件的 `run()` 開始看

**待 Faryne 決定要不要處理**：現況不是程式錯誤，若要讓「不管先補開頭還是先補結尾都能轉換」，需要換一套偵測邏輯（每次輸入都重新掃整個段落找配對，而不是只往回看游標前面），代價是效能較差、且有在使用者還沒打完整句話時就提早誤判轉換的風險。要不要處理、值不值得，Faryne 評估後再決定，這裡先記錄結論。

**案例 2：`/` slash command 選單與組字互動**
- [x] 在空白段落，用輸入法打「/標」（斜線加注音一個字，例如打「/」再打「標」這個字，中途讓候選字視窗開著）
- [x] 觀察 slash 選單在候選字視窗開著的狀態下會不會正常顯示、有沒有跑版或抖動：如果在候選字視窗選字時， menu 會跟著消失。Notion 是選字視窗及功能列都存在 => 2026-08-17 Claude 查證：根因很可能跟第 4 項（Escape 誤關選單）同一個問題——我們的 ArrowDown/ArrowUp 也沒檢查 composing 就搶去操作 slash 選單，可能跟 IME 候選字視窗自己的方向鍵選字互相干擾。已跟 Escape 一起修（見「已知 Bug 記錄」第 3 項），但這項本身描述的「選字時 menu 消失」沒辦法用瀏覽器自動化精準複現候選字視窗互動，建議 Faryne 重新測一次確認是否已解決
- [x] 選字完成後，確認選單內容有沒有正確篩選出「標題」相關選項
- [x] 測試組字期間按 Escape：確認是取消輸入法候選字，還是不小心關掉了 slash 選單（預期應該是先關輸入法候選字，不影響 slash 選單）：輸入 `/圖` 組字過程中按下 esc 後變成取消選字也關閉 slash 選單 => 確認取消候選字，但功能選單也消失，應該同本案例第二項 => 2026-08-17 已修，root cause 跟解法見「已知 Bug 記錄」第 3 項，待 Faryne 用真實輸入法覆測確認
- [x] 測試組字期間按 Enter：確認是完成選字，還是不小心觸發了 slash 選單裡的項目 => 確認完成選字，功能選單出現。
- [x] 記錄結果：中文輸入法的候選字操作（選字、Escape 取消）跟 slash 選單的操作會不會互相干擾、誤觸發（記錄任何不符預期的行為：發生時機、按了什麼鍵、結果是什麼） => 應該要與本案例的第二項一起看 => 見上方第 2、4 項備註

**案例 3：表格 cell 內中文組字**
- [x] 用 `/table` 或右鍵插入一張真表格  => 滑鼠右鍵功能選單沒有「插入表格」。另外發現「滑鼠右鍵」和「slash」指令出現的功能選單顏色與風格不一致 => 2026-08-17：兩項都已修。「沒有插入表格」root cause 跟解法見「已知 Bug 記錄」第 5 項；「顏色風格不一致」原本判斷要排進 Phase C 一起做，Faryne 指出 createTheme 施作時間還沒定不該卡在後面，改成當下就處理——開 MUI `cssVariables: true`、slash 選單改吃 `var(--mui-palette-*)`，不用整套 Phase C 的 semantic token 系統就能解掉，root cause 跟解法見「已知 Bug 記錄」第 7 項。**但 Faryne 在真實登入頁面複測時，發現這個修法帶出一個新問題：slash 選單每個項目前面的 icon 完全消失**（Playground 正常、真實頁面不正常，重新整理也沒用），原因還沒查出來，記錄在「已知 Bug 記錄」第 8 項，等 createTheme 工作開始時一併查
- [x] 點進任一個 cell，用輸入法打一段中文（組字中途候選字視窗開著時，確認畫面顯示正常、沒有跑到別的 cell 去）
- [ ] 打完後用 Tab／Shift-Tab 切換到別的 cell，確認切換不會打斷正在進行的組字（如果剛好在組字中途按 Tab，建議也測一次，確認候選字不會殘留或消失文字） => 會打斷選字，並且跳到下一個 cell  => 2026-08-17 已修，root cause 跟解法見「已知 Bug 記錄」第 4 項，待 Faryne 用真實輸入法覆測確認
- [ ] 記錄結果：cell 內中文輸入是否跟一般段落一樣順暢，Tab 切換會不會弄丟文字或打斷輸入 => 同第三項，選字時按下 tab 會跳到下一個 cell。另外發現在輸入注音符號時，表格會有抖動導致寬度變化。例如輸入到「中ㄨ」階段時，cell 寬度會有所變化，直到輸入成「中文」後才又正常。 => 2026-08-17：Tab 打斷組字已修（見上）；欄寬抖動問題 root cause 已查明（`table-layout:auto`），但涉及要不要一併做欄寬管理機制，這次先不修，記在「已知 Bug 記錄」第 6 項

#### 9.2 StoryEditor／LoreEditor 真實頁面操作

**為什麼不能自動化**：這幾項都需要你自己的登入帳號跟真實的 story/lore 資料，Claude 跟 Codex 的環境都沒有這個權限，也不會主動去借用你的登入狀態。

**測試步驟**（StoryEditor 跟 LoreEditor 各做一次，兩邊 UI 應該一致）：
- [x] 打開任一個故事（或設定集）的編輯頁面
- [x] 確認右上角看得到一個小的 action 區（語法說明「？」icon、匯出 icon、插入資產/AI Agent/編輯歷史相關按鈕），確認**沒有**看到舊的格式工具列（不會有一整排粗體/斜體/標題下拉那種橫向工具列）
- [x] 在內文隨便改一小段文字（例如加一句話）
- [x] 等幾秒，確認畫面上有出現 autosave 相關的提示（存檔中/已儲存之類的訊息，跟你熟悉的既有行為一致）
- [x] 重新整理整個頁面，確認剛剛改的內容還在（代表真的存檔成功，不是只在畫面上而已）
- [x] 看一下字數顯示的地方，確認數字有跟著你剛剛加的文字更新
- [x] 點開 AI Agent 面板（右上角 action 區的機器人 icon），試著用 AI 附加/插入一段內容，確認附加的內容有正確同步進編輯器內文
- [x] 點右上角的匯出圖示，確認會下載一個 `.md` 檔案，打開檔案確認內容看起來合理（沒有亂碼、沒有殘留 `⟦⟧` 這種內部標記語法外洩）
- [x] 點右上角插入資產的按鈕（或在空白段落打 `/圖片`），確認資產選擇視窗能正常開啟、選圖後能正確插入
- [x] 以上每一步是否都跟你印象中「拔工具列之前」的行為一致（只是操作入口從工具列變成右上角 action 區／右鍵選單／`/` 指令／選取文字後的浮動選單），任何一步不一樣（消失的功能、跑版、存檔失敗等）記錄下來，附上是 StoryEditor 還是 LoreEditor、做到第幾步發現的
- [x] 在 Reader（讀者頁面）加一個書籤，確認捲動／高亮能正確跳到對應段落——2026-08-16 Claude 已用 Playground 確認標題／引用／清單／真表格／腳注在 Reader 的 DOM/CSS render 都正確（見 Phase 8），但書籤高亮（`Reader.tsx` 的 `bookmark-line-{lineIndex}`／`storyHeadingAnchorId`）雖然是前端邏輯，實際觸發需要真實帳號建立過的書籤資料，Playground 沒有登入也沒有接真實 API，測不到，所以歸類到這裡

#### 9.3 表格 cell 貼上（paste）行為

**為什麼不能自動化**：瀏覽器自動化工具模擬剪貼簿貼上的行為跟真實作業系統的剪貼簿/瀏覽器貼上機制有落差，容易測出「假的沒問題」，不可靠。而且目前程式碼裡的貼上邏輯（`handlePaste`）原本是設計給一般段落用的，表格 cell 是不同的資料結構（`inline*`，不是完整段落），這條路徑實際上有沒有問題目前完全沒測過，值得認真測。

**測試步驟**：
- [x] 插入一張真表格（`/table` 或右鍵選單）
- [x] 準備一段純文字（例如從記事本複製一句話），點進某個 cell，貼上（Cmd+V），確認文字只會進到你點的那個 cell 裡，不會跑到別的 cell 或跑出表格外
- [x] 準備一段「有換行」的多行文字（例如複製三行不同的句子），點進某個 cell 貼上，觀察並記錄實際發生什麼（可能全部擠進同一個 cell，也可能出現非預期行為，這項目前沒有標準答案，重點是「有沒有把文件搞壞」） => 貼入五行文字，全部連成一行。手動使用「Enter」無法斷行。看起來不會搞壞表格，但要不要處理我還在猶豫。
- [x] 打開一個試算表軟體（Excel、Google Sheets、Numbers 都可以），選幾個相鄰的儲存格（例如 2 欄 x 2 列），複製，貼到表格的某個 cell 裡，觀察並記錄（不要求自動展開成多個 cell，這是第一版明確不做的功能，重點一樣是有沒有把文件搞壞）  => 呈現上像表格，但依然如同前一項目使用單行呈現且無法斷行
- [x] 選取表格內多個相鄰 cell（拖曳選取，畫面應該會出現藍色的 cell 選取範圍），再貼上一段文字，觀察並記錄實際狀況
- [x] 確認以上四種情境貼上後表格結構都沒有壞掉（不會整張表消失、不會跑出無法編輯的錯誤畫面），文件其他部分也不受影響——如果發現畫面卡住、表格結構明顯損壞、或跳出任何錯誤訊息，記錄下貼的是哪種內容、發生了什麼

備註：這些操作基本上都不會搞壞表格，但 UX 上有點不大對，目前我也沒打算要不要處理。可以請你和 Codex 討論是不是有深入研究處理的必要。 => 2026-08-17 已跟 Codex 討論，判斷值得做（使用者已經在實測時真的踩到，不只是理論上的邊界情況），列進 [Phase 8.1.2](#812-表格-cell-內軟斷行soft-break多行貼上)：導入 `HardBreak`／`Shift+Enter` 軟斷行，貼上多行文字時轉成軟斷行而不是壓成一行。這次只列項目規劃，還沒實作。

#### 9.4 Mobile 真實裝置觸控體感

**為什麼不能自動化**：瀏覽器自動化可以模擬手機螢幕寬度（CSS breakpoint 已經測過），但沒辦法模擬真實觸控手勢的手感（長按、雙指縮放、滑動選字）跟真實手機瀏覽器的行為差異。

**測試步驟**（用手機瀏覽器打開任一 Story/Lore 編輯頁面）：
- [x] 確認畫面排版正常，看得到右上角的小 action 區，沒有橫向格式工具列
- [x] 手指點一下空白段落，確認有沒有跳出鍵盤，並確認能不能看到 placeholder 提示文字
- [x] 打 `/` 試試看 slash 選單會不會跳出來、觸控點選選單項目是否順暢
- [x] 選取一段文字（長按拖曳選取範圍），確認選取文字後有沒有跳出 bubble menu（浮動小工具列），點裡面的按鈕（例如粗體）確認能正常套用——**這項建議優先測**：Claude 用瀏覽器自動化測 Phase 8 手機斷點時，發現這個工具本身在手機模擬模式下，單純「點一下」文字會被轉譯成類似長按/右鍵的行為、直接跳出區塊命令選單而不是把游標放在文字上，這讓 Claude 沒辦法在自動化測試裡完整重現「單指點一下 vs 長按拖曳選字」這兩種手勢的差異；不確定這是測試工具的模擬限制、還是編輯器本身在真實手機上點文字的行為也有類似的模糊地帶（例如單指點一下會不會誤觸發某個選單），需要用真實手機確認一次 => 2026-08-17 Faryne 用 Samsung S24 Ultra／Chrome 實測，證實這不是測試工具的模擬限制，是真的 bug——長按選字會連帶觸發右鍵選單邏輯，導致選取失敗。已查出 root cause 並修好，見「已知 Bug 記錄」第 9 項
- [x] 嘗試長按段落，看看有沒有辦法叫出右鍵選單的替代方案（這個編輯器的右鍵選單在手機上可能完全叫不出來，這是預期中的已知限制，重點是確認「除了右鍵以外的入口（slash／bubble menu）是否已經足夠涵蓋主要操作」）=> 2026-08-17 討論結論：不做行動版工具列，觸控裝置直接不觸發右鍵選單邏輯，讓原生長按選字正常運作，格式化改靠 bubble menu＋slash 兩個入口涵蓋（見已知 Bug 記錄第 9 項的修法）
- [x] 如果有圖片，確認圖片版面（全寬/置中/靠左/靠右環繞）在手機上是否都正確退回全寬顯示，不會有跑版的浮動效果
- [x] 記錄：用的是什麼手機/瀏覽器、哪個操作在手機上不順或做不到（即使右鍵選單在手機上不可用是預期內的限制，但如果某個操作完全沒有替代入口，這是需要記錄下來的落差）

使用手機：Samsung S24 Ultra 瀏覽器：Chrome
選取幾個文字和選取整段時，會觸發滑鼠右鍵動作，連帶讓選取操作先失敗。
思考是不是要讓行動版保留可收縮的完整工具列，並拔掉右鍵功能？

=> 2026-08-17 已修，不用加回工具列，見「已知 Bug 記錄」第 9 項。9.4 到此全部確認完成。

#### 9.5 長篇寫作體感（Placeholder／Slash／Bubble Menu／右鍵選單綜合）

**為什麼不能自動化**：這項不是在測「有沒有 bug」，是在測「用起來順不順手」——這種主觀體感只有真人實際寫一段文章才感受得出來，自動化工具沒辦法評估「這個提示會不會太吵」「這樣操作順不順」。

**測試步驟**：
- [x] 找一段你平常會寫的內容（或直接繼續寫某篇正在寫的故事/設定集），正常寫個幾分鐘，中間穿插你平常會用到的格式（標題、引用、清單、粗體、連結、圖片等）
- [x] 留意空白行的 placeholder 提示文字（「輸入 / 插入區塊；選取文字可套用樣式」）出現的時機順不順眼，會不會太常出現、太搶眼、或干擾閱讀
- [x] 留意用 `/` 插入區塊操作起來順不順手，跟你以前用工具列比起來是更快還是更麻煩
- [x] 留意選取文字後 bubble menu 跳出的位置、時機是否符合直覺
- [x] 留意右鍵選單找需要的功能好不好找
- [x] 記錄實際感覺（這是主觀感受，沒有「對/錯」答案，例如「placeholder 出現得太頻繁，看了很煩」「slash 選單找標題選項要滑很多下」這類具體回饋，之後可以再討論要不要調整）

修改建議：
- 故事頁及設定頁的「存檔」按鍵是否移到迷你工具列內？避免要手動存檔時還要把頁面拉到開頭按存檔的麻煩（這在行動版頁面的困擾更明顯）。或許搭配 Ctrl+s hotkey 的操作更好？ => 2026-08-17 已修：不動按鈕位置（那是更大的版面改動），改用 Ctrl/Cmd+S 全域快捷鍵直接觸發存檔，`StoryEditor.tsx`／`LoreEditor.tsx` 都加了，行為跟現有存檔按鈕一致（存檔中會擋掉重複觸發）。`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過
- 雖然跟這次修改無關：但插入資產的功能是不是可以加說明文字的輸入？並且在閱讀頁顯示該圖片的說明。目前只有替代文字，那算是圖片叉燒包的替代方案。 => 2026-08-17 這項跟圖片/資產有關，Faryne 決定挪進 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) 跟其他圖片相關項目一起處理，這裡不單獨動
- 現在工具列完全拔除，但原本工具列上的功能並沒有完全移出來，「文字背景色」就是其中之一。需要確認是否把功能都移進 select / slash menu 或是滑鼠右鍵 menu 中 => 2026-08-17 已修：右鍵選單本來就有背景色（`hasSelection` 分支的 `bgColorCommands`），缺的是 bubble menu——Phase 4 當初刻意不放（理由是工具列/右鍵選單還在），但工具列已經在 Phase 6 拔掉、觸控裝置上右鍵選單現在也直接放行給原生選字用（已知 Bug 記錄第 9 項），等於行動裝置完全沒有背景色入口。已在 `StorytellerWysiwygBubbleMenu.tsx` 補上背景色 popover，跟文字色同一套 UI 樣式。瀏覽器驗證：選取文字、點背景色、選色，確認 `getComputedStyle(...).backgroundColor` 正確套用
- slash menu 多個分隔線，把相同群組功能放在一起後使用分隔線分開，可以在之後 createTheme 項目一起處理？ => 使用者已決定排進 createTheme，這裡不重複記錄，見 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) Phase C

#### 9.6 圖片文繞圖真實閱讀體感

**為什麼不能自動化**：CSS 數值（浮動方向、寬度、清除規則）已經用瀏覽器自動化驗證過都正確套用，但「讀起來會不會太擠」「圖文比例協不協調」是真人閱讀體感，不是程式能判斷的。

**測試步驟**：
- [x] 找一篇有插圖、內容夠長的故事（或用測試內容），把其中一張圖設成靠左或靠右環繞（右鍵圖片 →「圖片設定」→ 選版面）
- [x] 用閱讀頁（Reader）實際讀一遍那段內容，感受一下文字環繞圖片的排版讀起來順不順、會不會覺得擠 => 參見已知 bug 中第 10 點 
- [ ] 如果那張圖後面接著標題、引用、表格或另一張圖，確認畫面有沒有跑版、疊在一起的狀況  => 使用「引用」時會有重疊的狀態 => 2026-08-17 圖片相關問題，Faryne 決定挪進 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) 一起處理，這裡先不單獨修
- [x] 用手機瀏覽器看同一段內容，確認圖片有正確退回全寬（不浮動），排版看起來自然
- [x] 記錄感覺：圖文環繞讀起來自不自然、有沒有跑版；如果覺得某個寬度比例不協調或哪裡讀起來卡卡的，記錄下來（例如「靠左環繞的圖片配短段落文字，環繞範圍太小看起來很怪」），之後可以評估要不要調整第一版的固定寬度比例

修改建議：
- 圖片置中時，在焦點為圖片情況下按 enter 不會斷行
- 圖片置中或是全寬時，如果輸入焦點在圖片的下一行使用 slash 指令插入分隔線，會讓原本的圖片元素消失/被吃掉？但如果再斷一行使用 slash 指令輸入分隔線就可以正常顯示分隔線和圖片
總之大部分操作都沒什麼問題，就是插入圖片後與其他元素的互動可能有很多問題需要仔細確認。

=> 2026-08-17：以上兩項都是圖片跟其他元素互動時的功能性問題，跟 9.6 開頭「引用重疊」、9.5「插入資產說明文字」放在一起，Faryne 決定不在這裡逐項修，統一挪進 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) 集中處理（該文件新增了對應章節列出這四項）。

## 分工計畫（2026-08-13，Claude × Codex 在同一 Codex CLI session 內對齊）

實作階段由 Claude 與 Codex 各自獨立開發、避免同時改同一批檔案，每個 phase 完成後交給對方 review，review 過才進下一個依賴它的 phase。工作基準點是 `codex/storyteller-wysiwyg-analysis` branch（commit `7717952` 之後接續開發），不另開新 branch，也不先 merge main。

### Track A（Claude）

- Phase -1：WYSIWYG Playground（前置項目，所有 Phase 之前）
- Phase 0：Markdown 自動 render + 刪除線
- Phase 1：Command Registry，重構工具列/右鍵選單（`StorytellerWysiwygEditor.tsx` 骨架改動集中在這裡）
- Phase 2：右鍵選單 context-aware 化 + 資產圖片 command 化
- Phase 4：Bubble Menu

### Track B（Codex）

- Phase 5：真表格全鏈路（TableKit 整合、逐列一行 marker 的 parser/serializer、reader renderer、export、後端 wordCount、MCP hint、舊 table-row 相容、`^\| $` input rule 清理）
- Phase 3：Slash Command，包含把 `/table` 接上 Phase 5 做好的真表格插入
- Phase 7：圖片版面控制（2026-08-13 使用者新提出，排在 Phase 5 真表格完成之後再做）

### Joint（兩邊都做）

- Phase 6：工具列移除（需要 Track A／B 都完成才能驗收）
- Phase 8：自動化／程式可驗證收尾（2026-08-16 從「全流程驗證」拆出，只留 Claude/Codex 能自己完成的項目）
- Phase 9：人工驗收案例（2026-08-16 新增，使用者親自操作，見該節完整測試步驟）

### 協作規則

1. **Phase 1（Track A）優先完成**：它會大改 `StorytellerWysiwygEditor.tsx` 的工具列/右鍵選單結構，Phase 2/3/4/6 都依賴它，不能兩邊同時動這個檔案。
2. **Track B 的 Phase 5 先不碰 `StorytellerWysiwygEditor.tsx` 的 toolbar/context menu 區塊**：先把 table node、table marker parser/serializer、reader/export/backend/MCP hint 做好，最多加 editor extension 與 imperative command（例如 `insertTable()`）；真正 UI 入口等 Phase 1（Command Registry）／Phase 3 落地後再接，避免跟 Track A 的大重構撞檔。
3. **共用檔案（`StorytellerWysiwygMarkdown.tsx`、`exportMarkdown.ts`、後端 wordCount／stripBookmark、diff strip 檔案）兩邊最終都會加自己的 case**（刪除線 vs 表格），衝突面小、屬於「同一個 switch/mapper 加 case」等級，用一般 git merge/rebase 加上互相 review 處理即可，不需要為此把邏輯拆得更碎。誰先完成該檔案的改動，就先留清楚註解與測試案例，另一邊 rebase 後再補自己的 case。
4. Review 時機：Track A 的 Phase 1 要讓 Codex review 過，Track B 的 Phase 3 才接上；Track B 的 Phase 5 要讓 Claude review 過，Phase 6 工具列移除才動工。

## 風險清單（合併版，按優先序）

1. **中文 IME 是所有改動裡風險最高的一項**。新增的 input rule、slash 的 `/` 觸發、bubble menu 的選取偵測、表格 cell 編輯全部是「即時攔截使用者輸入」的機制。Phase 0 的 IME 實測放在所有後續 Phase 之前，作為最小驗證關卡。
2. **`StorytellerWysiwygEditor.tsx` 已經 1597 行**，Command Registry（Phase 1）跟右鍵選單 JSX 都要獨立成檔，避免繼續惡化。
3. **拔工具列後可發現性下降**，這個編輯器功能數量（15 種＋刪除線）比一般 Notion 文件編輯器多。Bubble menu、保留語法說明入口是主要補償手段。
4. **右鍵在 mobile 幾乎不可用**，需確認 slash／bubble menu 是否足以覆蓋主要操作。
5. **右鍵選單新增區塊插入選項時，不能破壞既有「選取範圍被收合」的修正**——空白段落右鍵不該觸發任何需要 selection 的項目。
6. **真表格風險已大幅降低**（本輪對話收斂結果）：原本評估「會打破一行＝一個段落、書籤/diff 都要重新設計」的風險已透過採用逐列一行 marker 格式解除——書籤與 diff 都維持既有 line-based 模型，不需要新資料模型。剩餘風險收斂為：① escape 規則的邊界情況（cell 內含 `|`／`\`／既有 delimiter 混用）需要充分測試；② Tiptap `TableKit` 與現有 `MarkerParagraph` schema 的相容性需要 spike 驗證；③ 表格 cell 內的中文 IME 行為未經實測；④ AI agent 透過 MCP 手寫表格語法的實際可靠度需要在 Phase 8 用真實 MCP 呼叫驗證，不能只靠人工預期 syntax hint 足夠清楚。

## 已知 Bug 記錄

2026-08-17 起，凡是明確認定為 bug（不是設計限制、不是待評估的功能需求）的項目，都記錄在這裡：問題現象、root cause、解法，供後續 AI agent／使用者查閱，不用重新查一次。已修好的項目也保留記錄（含修法與 commit），不刪除。

### 1. Slash command 選單空白 `/` 時看不到「插入表格」「插入圖片」

- **現象**：在空白段落打 `/`（不打任何篩選字），選單只看得到「內文」「標題 1~6」「引用」，插入表格／插入圖片／清單／分隔線等功能完全不會出現，只有先打出正確關鍵字（例如「/表格」）才篩得到——但使用者不知道要打這幾個字，等於功能被隱藏。
- **Root cause**：`SlashCommand` extension（[slashCommandExtension.tsx](../../static_site/src/pages/storyteller/wysiwygCore/slashCommandExtension.tsx)）預設 `maxItems: 8`，而候選清單照群組排列 `heading`（內文＋標題1~6，共 7 項）→ `block`（引用／無序清單／有序清單／插入分隔線，共 4 項）→ `insert`（插入表格／插入圖片，共 2 項），空白查詢時前 8 項剛好被「heading 全部 7 項＋block 第 1 項（引用）」吃滿，`insert` 群組的兩個 command 永遠排不進截斷範圍。
- **解法**：把 `maxItems` 從 8 調高到 20（目前 registry 總共只有 13 個 slash command，20 留一點餘裕），選單本身已有 `max-height:260px` + `overflow:auto`，調高上限後配合既有捲動機制即可讓全部功能可見。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 2. Slash command 選單鍵盤上下鍵切換時，捲軸不會跟著移動

- **現象**：選單項目超過可視範圍時，用滑鼠可以捲動看到全部項目；但用鍵盤上下鍵切換選取項目，高亮捲到清單底部（例如選到「插入圖片」）時畫面捲軸不會跟著移動，使用者只看得到清單最上面沒被選到的項目，看不到目前實際選到哪一項。
- **Root cause**：`renderSlashCommandItems`（同一個檔案）在 ArrowDown／ArrowUp 觸發時只是重新畫過一次按鈕、把 `selectedIndex` 對應的按鈕加上高亮背景色，從來沒有呼叫 `scrollIntoView` 之類的方法把高亮項目捲進可視範圍。
- **解法**：在 render 迴圈裡，`index === selectedIndex` 的按鈕額外呼叫 `button.scrollIntoView({ block: "nearest" })`。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 3. IME 組字期間按 Escape，slash 選單會被一起關掉（Phase 9.1 案例 2 實測發現）

- **現象**：打 `/圖` 進入 slash 選單後，用注音組字打「圖」還沒選完字，這時按 Escape 原本應該只取消輸入法候選字（跟 Notion 一樣），結果連 slash 選單也一起被關掉了。
- **Root cause**：`SlashCommand` extension 的 `addKeyboardShortcuts()`（[slashCommandExtension.tsx](../../static_site/src/pages/storyteller/wysiwygCore/slashCommandExtension.tsx)）把 `ArrowDown`／`ArrowUp`／`Enter`／`Escape` 都直接綁去操作 slash 選單，完全沒有檢查 `this.editor.view.composing`（IME 是否正在組字中）。IME 候選字視窗開著時按 Escape，瀏覽器一樣會送出真實的 `keydown` Escape 事件，我們的 handler 不分青紅皂白攔下來當成「使用者要關 slash 選單」處理，跟 IME 自己取消候選字的行為搶在一起。
- **解法**：`handleKey()` 開頭加一行 `if (this.editor.view.composing) return false;`，組字中一律不攔截，讓瀏覽器/輸入法自己處理完這次按鍵，slash 選單狀態完全不受影響。四個鍵（含 ArrowDown/ArrowUp，理由：IME 候選字視窗常見也用方向鍵挑字，同一類風險一併防範；Enter 目前實測沒出包，但同樣邏輯下不特別排除)一併加上這個保護，不是只修 Escape 一項。
- **驗證方式**：因為真實 IME 組字沒辦法用瀏覽器自動化模擬（見 9.1 開頭說明），改用 `dispatchEvent(new CompositionEvent('compositionstart', ...))` 讓 `editor.view.composing` 真的變成 `true`（這是瀏覽器原生事件，ProseMirror 自己會監聽並更新這個狀態，不是憑空模擬），再送出帶 `isComposing:true` 的 Escape `keydown`，確認 slash 選單維持開啟。這個驗證方式能確認「程式邏輯正確反應 composing 狀態」，但沒辦法完全複現真實輸入法的每一種按鍵時序，建議 Faryne 之後用真實輸入法重新走一次 9.1 案例 2 確認。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 4. IME 組字期間按 Tab，會打斷組字並跳到下一個表格 cell（Phase 9.1 案例 3 實測發現）

- **現象**：在真表格 cell 裡用注音打字，組字還沒完成時按 Tab，游標直接跳到下一個 cell，正在組字的內容被打斷。
- **Root cause**：`StorytellerTableCell`（[storytellerTable.ts](../../static_site/src/pages/storyteller/wysiwygCore/storytellerTable.ts)）的 `addKeyboardShortcuts()` 把 `Tab`／`Shift-Tab` 直接綁去呼叫 `goToNextCell()`，同樣沒有檢查 `editor.view.composing`。組字中的文字其實還沒真正寫進 ProseMirror 文件，一按 Tab 就換到別的 cell（換節點），等於把還沒 commit 的組字內容整個丟掉。
- **解法**：`Tab`／`Shift-Tab` 的 handler 開頭加 `this.editor.view.composing ? false : goToNextCell(...)`，組字中直接回傳 `false`，不執行跳 cell，讓輸入法/瀏覽器自己處理這次 Tab。
- **驗證方式**：同上一項，用 `dispatchEvent(new CompositionEvent('compositionstart', ...))` 讓真正的 `editor.view.composing` 變 `true`，送出帶 `isComposing:true` 的 Tab `keydown`，確認 `window.getSelection()` 對應的 cell 內容沒有改變（游標留在原 cell）；接著送 `compositionend` 恢復非組字狀態，確認正常 Tab 依然能正確跳到下一個 cell（沒有把功能整個關掉，只是組字期間不跳）。同樣建議之後用真實輸入法覆測一次。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 5. 右鍵選單缺少「插入表格」（Phase 9.1 案例 3 實測發現）

- **現象**：游標在空白段落按右鍵，選單裡沒有「插入表格」這個選項（`/table` slash 指令跟工具列拔除前的行為都有這個功能，只有右鍵選單漏掉）。
- **Root cause**：`StorytellerWysiwygContextMenu.tsx` 在「沒有選取文字」的分支裡，只有從 `wysiwygCommandsByGroup("insert")` 挑出 `insert-image` 一個 command 特別渲染（`insertImageCommand`），`insert-table` 從來沒有被挑出來渲染過，等於整個 `insert` 群組裡的表格 command 從拆右鍵選單成獨立元件（Phase 2）以來就沒被接上。
- **解法**：新增 `insertTableCommand`（同樣從 `insert` 群組挑出 `insert-table`），跟 `insertImageCommand`放在同一個「插入」分隔線區塊一起渲染。跟 slash 選單的行為看齊：不像 `insert-image` 限制只能在空段落插入（因為 `insert-table` 本身在 registry 裡沒有 `isVisible`/空段落限制，slash 選單本來就不管段落是否為空都會顯示這個 command），表格是插入獨立節點，插在非空段落內容前後也合理。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 6.（待修，非本次一起修）真表格 cell 組字期間，欄位寬度會跳動

- **現象**：在表格 cell 內用注音組字，隨著候選字內容變化（例如「中」→「中ㄨ」→「中文」），cell 的寬度會跟著抖動，直到組字完成才穩定下來。
- **Root cause**：表格目前完全沒有設定 `table-layout` CSS 屬性，用的是瀏覽器預設的 `table-layout: auto`——這個演算法會即時依照目前每個 cell 實際內容的寬度重新計算欄寬，組字過程中每個中間狀態（不同字數的候選字）寬度都不一樣，欄寬自然跟著抖動。
- **為什麼沒有直接修**：最直覺的修法是換成 `table-layout: fixed`，但這需要搭配明確的欄寬設定（例如 `colgroup`/`col` 或第一列固定寬度），而目前這個真表格完全沒有欄寬管理機制（沒有 column resizing、沒有存欄寬資料）。如果只是單純切 `table-layout: fixed` 而不補欄寬設定，瀏覽器會把所有欄位拉成等寬，等於用「解決組字抖動」的代價換來「破壞既有依內容自動調整寬度的版面」（例如目前範例表格「狀態」欄本來就比較窄，換成 fixed 沒有欄寬設定會被拉成跟其他欄一樣寬）。這牽涉到要不要一併做欄寬管理，範圍比單純修一個抖動問題大，所以先記錄 root cause，不在這次一起動。
- **狀態**：未修，待評估是否要一併做表格欄寬管理機制後再處理。2026-08-17 已跟 Codex 討論收斂成具體規劃，見 [Phase 8.1.4](#814-表格欄寬column-width調整)（分兩階段：先穩定欄寬策略解決抖動，再評估真正的手動 column resize），這次只列項目規劃，還沒實作。

### 7. 右鍵選單跟 slash 選單顏色風格不一致（Phase 9.1 案例 3 實測發現）

- **現象**：右鍵叫出的選單跟打 `/` 叫出的選單，兩個概念上是同一種東西（都是「叫出操作選單」），但視覺完全不同套。
- **Root cause**：兩個選單是各自獨立刻的元件，從來沒有共用過視覺規格：
  - 右鍵選單（`StorytellerWysiwygContextMenu.tsx`）直接吃 MUI `<Menu>`，沒有任何客製樣式，長相就是 MUI Paper 的預設外觀，會跟著 `StorytellerLayout` 的 `createTheme`（`mode`／`palette`）一起變化。
  - slash 選單（`slashCommandExtension.tsx` 的 `createSlashCommandRenderer`）是純手刻 DOM，`mount()` 裡用 `style.cssText` 寫死了 `background:#fff`、`border:1px solid rgba(0,0,0,0.12)`、文字色 `rgba(0,0,0,0.6)` 這些顏色，完全沒有讀取 theme token，也不會跟著切換深色模式或色系。
  - 兩者不只是「風格不同」，深色模式下問題會更明顯：右鍵選單會正確變深色，slash 選單因為背景色寫死 `#fff`，深色模式下會是一塊突兀的白色方塊。
- **原本的判斷（已推翻）**：一開始覺得這件事該排進 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) 的 Phase C 一起做。但 Faryne 指出：createTheme 那個大工作的實際施作時間還沒定，這個具體的 bug 不該被卡在一個沒有時程的大案子後面，於是改成當下就處理。
- **解法**：不需要等 Phase C 那套完整的 semantic token 系統，用一個小步驟就能解決根本問題——在 `StorytellerLayout.tsx` 的 `createTheme()` 加一行 `cssVariables: true`。這是 MUI v6+ 內建的功能，開了之後 MUI 會把目前 palette 的每個顏色同步寫成 `--mui-palette-*` 這種 CSS custom property 掛在 `<html>` 上，會隨 `mode`／`palette` 切換即時更新。這樣手刻 DOM（不在 React tree 裡吃 `sx` 的那種）也能直接用 `var(--mui-palette-background-paper)` 這類語法讀到當下顏色，不用另外傳遞 theme context 進去。接著把 `slashCommandExtension.tsx` 裡寫死的 `#fff`／`rgba(0,0,0,...)` 全部換成對應的 `var(--mui-palette-*, 原本的值)`（背景吃 `background-paper`、文字吃 `text-primary`、邊框吃 `divider`、選取高亮吃 `action-selected`、圖示吃 `text-secondary`；保留第二個 fallback 參數，這樣沒有 `ThemeProvider` 的頁面——例如 dev-only 的 Playground——外觀完全不受影響）。
- **驗證**：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 40/40 通過。瀏覽器驗證：在有套用 `StorytellerLayout` 的公開頁面（`/storyteller` 首頁）切換深色/淺色模式，讀 `getComputedStyle(document.documentElement)` 確認 `--mui-palette-background-paper`／`--mui-palette-text-primary` 等變數會隨模式即時更新成正確色碼；另外在 `document.body` 下建立一個套用同樣 `var(--mui-palette-*)` 樣式的測試元素（模擬 Suggestion 選單用 portal 掛到 body、不在 React tree 內的情境），確認深色/淺色模式下都能正確讀到對應顏色，不是退回 fallback 值。Playground（沒有 `ThemeProvider` 包起來的頁面）另外截圖確認外觀維持原本白底黑字，沒有跑版。
- **範圍說明**：這次只修了 slash 選單，因為這是這次實測明確指出的項目；bubble menu／table menu 目前是吃 MUI `<Paper>`/`<Menu>` 元件本身（不是手刻 DOM 寫死顏色），沒有這個問題，不需要一起動。`cssVariables: true` 這個底層開關留著，之後 Phase C 如果要做更完整的 component override，也可以繼續用同一套 CSS variables，不衝突。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 8.（未解決，原因待查）真實登入頁面上，slash 選單每個項目前面的 icon 完全不見

- **現象**：Faryne 在真實頁面（`localhost:5173/storyteller/my/workspace/.../lore/...`，登入後的 LoreEditor）打 `/` 叫出選單，「內文」「標題 1~6」「引用」每一項前面都沒有 icon，文字直接貼齊最左邊，跟 icon 應該佔用的位置完全沒有空隙（不是 icon 顏色跟背景一樣看不見，比較像是 icon 那個 DOM 元素根本沒被建立出來）。Playground（`/storyteller/wysiwyg-demo`）用一模一樣的 command registry 跟 renderer 測，icon 完全正常。
- **已排除的可能性**：
  - 不是有兩份不同的元件——整個 codebase 搜過，`slashCommandExtension.tsx` 只有一份，右鍵選單／slash 選單／Playground／真實頁面全部吃同一份 command registry 跟同一個 renderer。
  - 不是 build 方式不同——Faryne 用的是自己另外開的 `localhost:5173` dev server（`npm run dev`），跟 Claude 測試用的 dev server 是同一種 Vite dev 模式，不是 production build，原本懷疑的「`react-dom/server`（`renderToStaticMarkup` 用的套件）在 build 後的環境解析方式不同」這個方向排除。
  - 不是 HMR 沒吃到最新程式碼——Cmd+Shift+R 強制重新整理後問題還在，排除「瀏覽器裡還在跑修改前的舊版 JS」這個可能性。
  - Console 沒有任何跟 `renderToStaticMarkup`／icon 渲染相關的錯誤，只有既有的 SSR pseudo-class 警告（跟這個問題無關）。
- **目前唯一還沒排除、但也還沒證實的方向**：icon 是透過 `renderCommandIconMarkup()`（[slashCommandExtension.tsx:68-73](../../static_site/src/pages/storyteller/wysiwygCore/slashCommandExtension.tsx#L68)）呼叫 `renderToStaticMarkup(createElement(icon, {fontSize:"small"}))` 動態產生 SVG 字串、再用 `innerHTML` 塞進手刻的 DOM——這整段是在 React tree 之外執行的（不是 JSX 渲染），跟 Playground 唯一環境差異是真實頁面被 `StorytellerLayout` 的 `ThemeProvider` 包住（含這次新開的 `cssVariables: true`）。有沒有可能 `renderToStaticMarkup` 在被 `ThemeProvider`/`cssVariables` context 包住的情況下呼叫行為不同（例如 MUI icon 元件內部呼叫 `useTheme()` 時，因為 `renderToStaticMarkup` 是脫離正常 React tree 的獨立同步渲染、拿不到外層 context，導致跟平常不同的 code path），純屬猜測，還沒驗證過。
- **狀態**：未解決。Faryne 決定先記錄下來，等 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) 正式開始施作、要重新處理 slash 選單樣式時一併查——屆時很可能會把這個手刻 DOM + `renderToStaticMarkup` 的作法整個換掉（改成用真正的 MUI 元件或至少不再脫離 React tree 渲染 icon），不一定需要先查出目前這個做法為什麼在真實頁面失效。

### 9. 手機真機上長按選字會被右鍵選單邏輯搶走，導致選取失敗（Phase 9.4 真機實測發現）

- **現象**：Faryne 用 Samsung S24 Ultra／Chrome 實測，長按拖曳選取文字時會觸發類似滑鼠右鍵的動作，選取操作因此失敗。這推翻了 Phase 8 手機斷點驗證時的假設——當時 Claude 用瀏覽器自動化測試工具在 mobile 模擬模式下也觀察到類似現象（點擊被轉譯成 contextmenu），但因為無法排除是「測試工具本身的模擬限制」還是「編輯器真的有這個問題」，當時只能記錄疑點、標記需要真機覆測（見 Phase 9.4 案例第 4 項備註）。這次真機測試證實：**不是測試工具的問題，是編輯器本身的真實 bug**。
- **Root cause**：`StorytellerWysiwygEditor.tsx` 的 `handleEditorContextMenu`（[StorytellerWysiwygEditor.tsx:597](../../static_site/src/pages/storyteller/StorytellerWysiwygEditor.tsx#L597)）不分裝置、一律在 `contextmenu` 事件觸發時呼叫 `event.preventDefault()`，而且只要點擊/觸控位置不在「目前已存在的選取範圍內」，就會直接把選取範圍收合成單一游標（`editor.commands.setTextSelection(result.pos)`）。行動裝置上長按（開始選字的手勢）本身就會觸發瀏覽器原生的 `contextmenu` 事件——使用者才剛長按要開始選字，選取範圍還沒真的選出來（或選取還在進行中），我們的 handler 就搶先把它當成「使用者要叫出右鍵選單」處理，選取範圍因此被收合掉，長按選字整個失敗。
- **解法**：不做行動版工具列（不重新引入拔掉的複雜度）。改成用 `window.matchMedia("(pointer: coarse)")` 判斷「主要輸入是不是觸控」（不是用螢幕寬度斷點——寬度斷點測的是螢幕多寬，這裡要分辨的是使用者用什麼方式操作，桌面瀏覽器縮視窗到很窄仍然是滑鼠右鍵），觸控裝置上 `handleEditorContextMenu` 直接 early return，完全不攔截這個事件，讓原生長按選字／系統選單正常運作。格式化功能改靠已經驗證過的兩個入口：選字完成後 bubble menu 會自動跳出（`StorytellerWysiwygBubbleMenu.tsx` 的 `shouldShow` 只看「目前有沒有非空文字選取」，不管這個選取是滑鼠拖出來的還是手指長按拖出來的，原生選字不再被搶走後應該正常觸發）；空段落插入區塊則靠 `/` slash command（Phase 9.4 已經測過在手機上正常運作）。
- **驗證**：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。瀏覽器驗證（`resize_window` 切到 mobile preset，確認 `matchMedia("(pointer: coarse)").matches` 為 `true`）：在段落上建立一段真實文字選取，dispatch 原生 `contextmenu` 事件，確認選單沒有跳出來（`[role="menu"]` 不存在）、選取範圍完全沒被動到（前後 `window.getSelection().toString()` 一致）、`event.defaultPrevented` 是 `false`（沒有攔截，原生行為可以繼續）；切回桌面寬度（`matchMedia` 確認 `false`）重複同樣測試，確認右鍵選單正常跳出（截圖確認），沒有回歸。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

### 10. 圖片文繞圖的比例，編輯器跟閱讀頁不一致（2026-08-17 使用者截圖比對發現）

- **現象**：Faryne 貼了編輯頁跟閱讀頁的截圖比對，同一段含直式構圖圖片的內容，兩邊排版明顯不同——閱讀頁的圖片顯著比編輯器裡看到的大，連帶讓文繞圖時「跟圖片並排的段落數量」也不一樣。
- **第一次診斷（已推翻）**：一開始懷疑是 `maxHeight` 不一致（編輯器寫死 `360`，Reader 是 `{ xs: 420, md: 640 }`），已經把編輯器的 `maxHeight` 對齊成跟 Reader 一致。但改完後 Faryne 再截圖比對，比例還是不對，判斷「沒改到核心」。
- **真正的 root cause**：請 Faryne 在瀏覽器 devtools 直接量測兩邊圖片的實際 render 尺寸，數字顯示**圖片本身渲染出來的 px 完全一樣**（`imgWidth:220`／`imgHeight:479.39`，兩邊逐位元相同）——代表 maxHeight 從頭到尾都不是問題，圖片沒有「變小」，是兩邱的**內文欄寬差太多**：編輯器內文欄寬（`.tiptap.ProseMirror`）實測 **1676px**，閱讀頁內文欄寬（`<p>`）實測 **902px**，將近兩倍差距。Size preset 原本的公式是 `min(百分比, px上限)`（例如 float 大圖是 `min(45%, 360px)`），這個 px 上限剛好卡在閱讀頁的欄寬附近（900px 上下），代表閱讀頁幾乎不受上限影響、百分比正常發揮；但編輯器欄寬一旦超過臨界值（float 約 800~900px、center 約 800px），上限就會先卡住百分比——同一個 size 選項因此在兩邊呈現出完全不同的「佔內文欄寬比例」（編輯器只佔 13%，閱讀頁接近 25%），不是圖片大小的問題，是**相對比例**的問題。
- **解法**：拿掉 `FLOAT_SIZE_WIDTH`／`CENTER_SIZE_WIDTH`（[assetImageLayout.ts](../../static_site/src/pages/storyteller/wysiwygCore/assetImageLayout.ts)）裡的 px 上限，改成純百分比（跟原本就是純百分比的 `BLOCK_SIZE_WIDTH` 一致）。拿掉上限後，圖片寬度直接跟著各自的內文欄寬等比例縮放，兩邊「佔比」永遠一致，不會再被一個針對特定欄寬校準出來的 px 上限打亂比例。圖片本身還有 `maxHeight`＋`objectFit:contain` 頂著（[assetImageNode.tsx](../../static_site/src/pages/storyteller/wysiwygCore/assetImageNode.tsx)／[StorytellerWysiwygMarkdown.tsx](../../static_site/src/pages/storyteller/StorytellerWysiwygMarkdown.tsx)），直式構圖的圖片在很寬的容器裡撐大到一定程度後，會先被高度上限頂住縮回來，不會無限跟著容器變大。
- **考慮過但沒採用的方向**：
  - 方案 2（把編輯器內文欄寬也加上限，縮到接近閱讀頁的 ~900px）——會變成整個編輯頁版面風格的改動（置中窄欄寫作），影響範圍遠大於這次的圖片問題，而且閱讀頁的 902px 本身不是刻意選定的常數（`Reader.tsx` 完全沒有 `maxWidth`／`Container` 設定，902px 只是側邊欄目錄佔掉之後剩下的空間，會隨視窗寬度浮動），沒有一個穩定的目標值可以精準對齊。
  - 「把閱讀頁做成跟工作台一樣全出血」——Faryne 提出後雙方討論過，這個方向會犧牲閱讀頁對真實讀者的閱讀舒適度（長文一行字數過長不利閱讀），且閱讀頁使用者是讀者本人、不是作者，影響的優先序不同，不適合為了這次圖片比例問題順便改掉。討論結論：**這其實是「閱讀頁整體版面比照工作台」這個更大的產品目標，跟 [視覺主題(createTheme)規劃.md](視覺主題(createTheme)規劃.md) 的精神一致，記錄進那份文件的後續方向，另外排時間處理，不在這次一起做**。
- **驗證**：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。瀏覽器驗證：用 JS 建立兩個分別是 1676px／902.66px 寬的容器，套用同一條 `45%` 規則，確認算出來的比例（`imgWidth / containerWidth`）兩邊都是 `0.44999...`，完全一致（改動前這兩個容器算出來的寬度會被 360px 上限打斷，比例明顯不同）。
- **狀態**：已修，與本節文件更新同一個 commit 一併送出。

## 兩份前文的分歧與收斂紀錄（含本輪 Codex CLI 對話新增項目）

| 項目 | Claude 原始立場 | Codex 立場 | 收斂結果 |
| --- | --- | --- | --- |
| 表格互動範圍 | 先做 `table-row` MVP，真表格另案 | 已定案改真 table node | 已由使用者拍板：採真表格，兩邊一致 |
| **表格序列化格式** | Claude final 假設：跨多行巢狀 marker，會打破一行一段落 | Codex final：留待 spike，傾向單行 escape marker；本輪對話中一度提出 base64url(JSON)，經 Claude 查證 MCP 資料流後指出 AI 無法讀寫，Codex 修正為逐列一行 marker | **本輪 Codex CLI 對話收斂**：逐列一行 marker（`⟦table tableId rowId⟧\| ... \|⟦/table⟧`），不打破 line-based 架構，AI agent 可透過 MCP 直接讀寫 |
| `--` 語意 | 待確認 | 待定義 | 已收斂：`--` 是刪除線、`---` 是分隔線 |
| 標題語法範圍 | 未特別提出疑慮 | 未特別提出疑慮 | 已由使用者確認：H1–H6，白名單已支援 |
| Markdown 自動 render 排序 | 獨立排最前面（Phase 0） | 放在後段，跟其他 UI 改版一起排 | 採 Claude 立場：獨立成 Phase 0 |
| 工具列移除時序與範圍 | 獨立最後一個 Phase，需驗收條件；可保留極簡求助入口 | 跟右鍵/bubble menu 一起做 | 時序採 Claude 立場（獨立 Phase、需驗收條件）；範圍已拍板：完全拔除 |
| **圖片插入現況與工作量** | Claude final：編輯器內完全沒有主動插入入口，只能拖曳，工作量大 | Codex final：不是從 0 開始，已有 `insertAsset`／`StorytellerAssetPickerDialog`，只需 command 化 | **本輪 Claude 查 code 修正**：Codex 判斷正確，`insertAsset` 已是完整可用的 imperative method，StoryEditor／LoreEditor 已用 toolbarExtra 按鈕接上；真正工作量是「改成 command registry 的 command，透過 context callback 觸發頁面層 asset picker」，比 Claude 原估小 |
| ~~分隔線 `---` input rule 是否存在~~ | 待確認 | 已存在 | **本輪 Claude 查 code 確認**：Codex 判斷正確，`markerParagraph.ts:265-270` 已有，無額外工作 |
| Command Registry / 三入口分工 | 同意 | 同意 | 兩邊一致，無分歧 |

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
- [ ] 顯示 raw content textarea／preview／serialized output，方便檢查 marker——raw content textarea 已做；Reader preview pane 未做（Codex review 標為 P2，排到 Track B 開始 Phase 5 前補上）
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
- [ ] **人工實測中文 IME：組字中途輸入 `*`／`_`／`+`／`~`／`^`／`-` 等符號的行為，退格、快速切換候選字——尚未完成**。已用瀏覽器自動化對 playground 做過「已組字完成」文字的逐字元真實按鍵測試（`--`／`++`／`~`／`^`／`*`／`_`／`**` 都正確觸發/正確排除），但這不等於「注音/拼音組字中途」的行為，自動化工具無法模擬真正的 IME composition 狀態，需要人工用實體鍵盤搭配輸入法測試才算完成——這是風險清單裡標記最高風險的一項，不要跳過
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

- [ ] 引入 Tiptap `Suggestion` utility，`/` 觸發，僅限空文字區塊、selection 為空時生效
- [ ] 中英文 alias
- [ ] 選擇 command 後正確刪除 `/query` 文字
- [ ] 人工實測中文 IME：輸入 `/標`、注音組字期間 suggestion menu 的互動、Escape/Enter 行為

### Phase 4：Bubble Menu

- [x] 選取文字時顯示：粗體/斜體/底線/文字色/連結/註解——新檔 `StorytellerWysiwygBubbleMenu.tsx`，用 `@tiptap/react/menus` 的 `BubbleMenu`（注意：`@tiptap/react` 根匯出點沒有這個元件，要從 `/menus`子路徑匯入，不是新增依賴，`@tiptap/extension-bubble-menu` 已經是 `@tiptap/react` 的既有 transitive dependency）；文字色只放常用的文字前景色（不含背景色，Bubble Menu 空間有限，背景色/下標/上標/刪除線/腳注等完整功能仍在右鍵選單/工具列）；註解按鈕遵守 `isFeatureEnabled("comment")` 可見性開關
- [x] 跟右鍵選單共用同一份 command registry——沒有重新定義任何 command，`markCommands`／`textColorCommands`／`linkCommand`／`commentCommand` 都是從 `wysiwygCommandsByGroup`／`getWysiwygCommand` 取，UI 呈現（浮動小工具列 vs 右鍵選單列表）不同，但底層動作是同一份

### Phase 5：真表格（設計已定案，見上方「真表格最終設計」，本 Phase 是實作項目）

- [ ] 評估 Tiptap `TableKit`：schema、commands（新增/刪除列/欄）、cell selection、IME 在 cell 內的行為、paste 行為——2026-08-14 第一段實作先採用 `@tiptap/pm/tables` primitives + 自有 Tiptap table/tableRow/tableCell nodes，已接 schema 與基礎 row/column command；cell selection、IME、paste 尚未實測，故本項維持未勾
- [ ] 實作 `/table` 插入真正 table node（預設列/欄數可再定）
- [ ] cell 內支援基本行內樣式：粗體、斜體、底線、刪除線、文字色、連結、註解（腳注是否允許放 cell 內可另外評估）
- [ ] 表格的新增列/刪除列/新增欄/刪除欄操作入口：規劃放在表格內的右鍵選單或浮動控制項，這些入口是否齊全，直接影響 Phase 6 工具列移除的驗收
- [x] 實作逐列一行 marker 的 parser／serializer（含 escape/unescape 規則）——已支援 `⟦table tableId="..." rowId="..."⟧| cell | cell |⟦/table⟧` 解析成 table node、相鄰同 `tableId` rows group 成同一張表、serializer 拆回逐列一行 marker；cell escape 規則已照定案處理 `\|`／`\\`／`\n`，並補 `tableMarker.test.ts` 覆蓋 round-trip 與欄數不一致補空 cell
- [ ] 閱讀頁 renderer：把同 `tableId` 相鄰 row group 成真正 `<table>`
- [ ] 匯出 markdown：輸出標準 markdown table
- [ ] 後端 word count／書籤 preview 對新 table marker 的 strip 邏輯
- [ ] `storytellerContentMarkerHint`／`storytellerContentSyntaxHint` 補上表格語法範例與規則說明，讓 AI agent 能透過 MCP 讀寫表格
- [ ] parser／reader 保護性 fallback：malformed row 不丟資料、無法 parse 退回純文字、`tableId` 缺失時的補救邏輯、row cell 數不一致時補空 cell
- [ ] 舊 `table-row` 資料相容：parser 保留讀取能力，新增內容不再產生 `table-row`，提供手動「轉換成新表格」command，不靜默自動轉
- [ ] 移除或改接 `markerParagraph.ts` 既有的 `^\| $` input rule（目前會自動產生舊格式 `table-row` 段落），避免打 `| ` 仍能繞過「新增內容不再產生 table-row」的原則
- [ ] 第一版明確不做：合併儲存格、調整欄寬、排序、公式、巢狀表格、cell-level bookmark、cell-level diff、貼上純文字 pipe table 自動辨識

### Phase 6：工具列移除（獨立、放最後、需驗收條件）

- [ ] 驗收條件：slash command 已涵蓋所有區塊操作，含 Phase 5 的表格插入與表格內新增/刪除列欄操作
- [ ] 驗收條件：右鍵選單已涵蓋所有行內操作與區塊操作
- [ ] 驗收條件：中文 IME 在 Phase 0／Phase 3／Phase 5（表格內 IME）都已實測過，沒有已知問題
- [ ] 移除工具列（已定案完全拔除，不保留極簡求助 icon）
- [ ] 幫 `StorytellerWysiwygSyntaxDrawer`（語法說明側欄）找一個不屬於工具列的新入口
- [ ] StoryEditor／LoreEditor 實測：autosave、字數、AI agent 附加、匯出 markdown 不受影響

### Phase 7：圖片版面控制（Track B／Codex 負責，排在 Phase 5 真表格完成之後）

2026-08-13 使用者提出的新需求：資產圖片目前編輯器跟閱讀頁都強制 `width:100%`／`display:block`，沒有靠左/靠右/置中的「文繞圖」（圖片浮動、文字環繞）效果。跟 Claude／Codex 在同一 Codex CLI session 討論後定案，指派給 Track B（Codex），排在 Phase 5 真表格完成之後（表格是資料模型層級的大改動，優先權更高，不要互相搶時間）。

**設計要點（已定案，不是待討論事項）**：

- **不重用段落既有的文字 `align` 屬性**：`align` 預設值就是 `"left"`，若把圖片段落的 `align="left"` 直接解讀成 float-left，所有既有圖片會從目前的 full-width block 靜默變成左浮動窄圖，是破壞性變更。改成在 `assetImage` 節點自己新增獨立的 `layout` 屬性（`block` / `center` / `float-left` / `float-right`），沒有 `layout` 的舊圖片一律當 `block`，行為完全不變，不需要遷移。
- **寬度第一版固定比例，不做拖曳調整**：`block` 全寬；`center` 約 `min(80%, 720px)` 置中；`float-left`／`float-right` 約 `min(45%, 360px)`；手機螢幕（小於某個 breakpoint）一律退回 `block` 不浮動。拖曳調整寬度另開後續需求，不在第一版範圍。
- **float 清除規則**：一般段落文字可以環繞在浮動圖片旁邊；標題、引用、清單、分隔線、表格、下一張圖片預設要 `clear: both`，避免版面疊在一起。編輯器跟閱讀頁要套同一套規則，確保編輯時看到的畫面跟讀者看到的一致。
- **操作入口是圖片專屬的 layout command，不是複用 Phase 1 的文字對齊 command**（`align-left`/`align-center`/`align-right` 語意是文字對齊，跟圖片的 float 語意不同，混用會混淆）；入口先接右鍵選單（游標/selection 在圖片 node 上時顯示）或之後的 Bubble Menu。
- **匯出 markdown 第一版直接退化**：標準 markdown 沒有文繞圖語法，匯出時全部輸出成一般靠左圖片，不勉強保留浮動效果。

**Checklist**：

- [ ] `assetImageNode.tsx` 的 `assetImage` 節點新增 `layout` 屬性（`block`/`center`/`float-left`/`float-right`，預設 `block`）
- [ ] 編輯器 NodeView（`AssetImageView`）依 `layout` 套用對應 CSS（float+固定寬度 vs block+置中/全寬），手機退回 `block`
- [ ] 閱讀頁 `StorytellerWysiwygMarkdown.tsx` 的圖片 render 邏輯同步支援 `layout`，跟編輯器套同一套寬度/breakpoint 規則
- [ ] 非 paragraph block（標題／引用／清單／分隔線／表格／下一張圖片）預設 `clear: both`，編輯器與閱讀頁都要套用
- [ ] 圖片專屬的 layout command 加進 `wysiwygCore/commands.ts`（新 group，例如 `image-layout`），right-click 選單在游標/selection 落在圖片 node 上時顯示這組 command
- [ ] 序列化：`layout` 屬性寫進 `⟦⟧` 段落 marker 或圖片自身語法（實作前需定案存放位置，避免跟既有 `align` 屬性混淆）
- [ ] 匯出 markdown：圖片一律退化輸出成無浮動效果的一般圖片語法
- [ ] 舊資料相容：沒有 `layout` 屬性的既有圖片維持 `block` 全寬，行為不變，不需要遷移
- [ ] 人工瀏覽器實測：三種 layout 在編輯器與閱讀頁的視覺效果、float 後接標題/引用/表格等 block 的 clear 效果、手機斷點退回 block

### Phase 8：驗證與收尾

- [ ] StoryEditor／LoreEditor 全流程實測：autosave、字數、AI agent 附加、匯出 markdown
- [ ] Reader 實測：標題、引用、清單、真表格、腳注、書籤、行距、圖片文繞圖
- [ ] Diff 實測：只改註解／顏色／腳注／刪除線文字時的差異是否符合預期，含表格逐列 diff
- [ ] CJK IME 實測：注音、拼音、選字中 Enter/Escape/Backspace、組字跨 mark 邊界、表格 cell 內組字
- [ ] Mobile 實測：右鍵不可用時，是否仍可透過 bubble menu / slash command 完成主要操作；圖片 layout 是否正確退回 block
- [ ] MCP：實際請 AI agent 透過 `storyteller_upsert_story`／`storyteller_upsert_lore` 寫入一次含表格的內容，確認 syntax hint 足夠讓 AI 手寫出合法 table marker

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
- Phase 8：全流程驗證

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

# Storyteller Notion 風工作台交接（結案版）

本文件記錄 Storyteller（SteamLoom）Notion 風工作台改版的最終狀態。這個項目到本文件寫下的時間點為止**已結束**，後續若要再擴充，請先讀完本文件的「已知技術債／刻意不做的事」再動手，避免重工或誤判成 bug。

## 現況總覽

- 所有改動都在 `main` branch 上（開發過程用過 `codex/storyteller-explorer-mockup`，已用 `--no-ff` merge 回 `main`，沒有 push，push/部署由使用者自己決定時機）。
- 範圍只有前端（`static_site/`），**完全沒有動後端 / migration**。
- 主要 commit（由舊到新，皆已存在於 `main`）：
  ```
  103b51d feat(storyteller): 新增 Notion 風工作台列表
  e05e322 feat(storyteller): Notion 風工作台右欄嵌入作品編輯器
  b970b32 feat(storyteller): workspace 側邊欄路由化、麵包屑、冊拖曳排序等一批工作台功能
  88d0d7a fix(storyteller): 工作台麵包屑在手機版寬度會被擠到看不見
  712aad4 feat(storyteller): 資產也補上工作台路由，並補回工作台頁的 useTitle
  90b84a6 feat(storyteller): 工作台右欄補齊載入/錯誤狀態，版本比較改用 modal
  b282956 feat(storyteller): 帳號工作台改用 Notion 風側邊欄，整併作品/AI Agent 建立與編輯
  60d56c0 Merge branch 'codex/storyteller-explorer-mockup'（併入 main）
  70ee2ba fix(storyteller): 移除專案工作台頂欄「舊管理頁」連結
  ee1abe5 fix(storyteller): 嵌入編輯器標題與 chip/存檔按鈕改同一列左右對齊
  09fb5c5 feat(storyteller): 作品/設定/資產列表補上所屬冊/設定集/資產集 chip
  ```
  另外同一批工作內還有一個非 storyteller 的獨立 commit：`eeec60a feat: ErrorPage 主站插圖改用隨機挑選，圖片統一放到 public/error-page`（見下方「ErrorPage 插圖」章節）。

## 已完成範圍

### 1. 專案工作台（`/my/workspace/:id`）

- 左欄 explorer 風格側邊欄，三大分組：作品與冊 / 設定集 / 資產集，各自有「全部／未分冊(類)／個別分組」節點，顯示筆數。
- 冊（volume）支援拖曳排序，可拖曳的列有 tooltip 提示。
- 建立冊／設定集／資產集的按鈕移到各分組標題旁（不再放右欄 action bar）。
- 側邊欄底部有色系切換（沿用既有 11 款色系）。
- 頂欄（`WorkspaceChrome`）：`SteamLoom > 我的工作台 > 專案名稱 ▾ > 分組 > 收藏集`，專案名稱可點擊切換其他專案（click 開，不用 hover；每個專案間有分隔線；只顯示名稱與最後更新時間，不顯示 slug/public_id/token）。手機版寬度下麵包屑會自動收起「SteamLoom」「我的工作台」兩段、並可橫向捲動，不會被擠爆。
- 右欄依左欄選取顯示「列表」或「編輯器」：
  - 列表：分頁、搜尋（資產）、建立、公開/草稿切換、移動到分組、編輯、刪除。
  - 編輯器：故事／圖像／設定集／資產都是**直接嵌入右欄**，不再跳轉到獨立頁面。
- 作品／設定／資產列表項目，若有所屬分組，會多顯示一個可點擊的分組 chip（點了直接切換到該分組）；未分類/未分冊則不顯示 chip。**即使目前就篩選在該分組內，項目仍會重複顯示同一個 chip**（沒有做「當前分組不顯示」的去重，這是刻意先求簡單，不是遺漏）。
- 頂欄「舊管理頁」連結已移除——工作台右欄已經能建立/編輯專案本身、故事、設定集、資產，不需要逃生口跳回舊頁面。

### 2. 帳號工作台（`/my`）

- 原本是 `StorytellerShell` + MUI `Tabs`（創作專案／AI Agent／金鑰管理／用量報表／MCP 連接），現在改成跟專案工作台同一套 `WorkspaceChrome` + 側邊欄（`HomeSidebar.tsx`），左側 5 個固定項目取代原本的 Tabs。
- `activeTab` 改成純粹從 `location.pathname` 逐次 render 推導（不再用 `useState` + `useEffect` 同步），跟專案工作台的 `selected` 推導方式一致。
- `/my/project/new`、`/my/project/:id/edit`、`/my/agent/new`、`/my/agent/:agentId/edit` 這四條路由**不再各自渲染獨立頁面**，改成一律渲染 `StorytellerHome`，由 `Home.tsx` 依路徑判斷要顯示列表還是把 `NewProject`/`NewAgent` 以 `embedded` 模式嵌入右欄（模式與故事/設定集編輯器共用同一套「回列表」出血容器 `EditorBleedContainer`）。
- `NewProject.tsx` / `NewAgent.tsx` 新增 `embedded?: boolean` prop：
  - `embedded=true` 時用 `StorytellerShell` 的 `plain` 模式（無麵包屑、無蒸汽面板外殼）。
  - 存檔成功後的導向改成回工作台（建立專案成功導去 `my/workspace/:id`，編輯專案成功導回 `my/project` 列表，Agent 一律導回 `my/agent` 列表）。
  - 找不到專案/Agent 時改用 `<ErrorPage compact backUrl=.../>`，不再各自寫死的 Alert 或全頁 404。
- AI Agent 的版本比較（Prompt 編輯歷史）從導去獨立頁面 `AgentDiffCompare.tsx` 改成跟故事/設定集共用同一顆 `StorytellerVersionCompareDialog` modal，見下方「版本比較」章節。

### 3. 版本比較（`StorytellerVersionCompareDialog.tsx`）

- 原本故事/設定集各自有獨立頁面（`StoryDiffCompare.tsx`／`LoreDiffCompare.tsx`）、Agent 也有自己的 `AgentDiffCompare.tsx`，現在三者統一改用同一顆共用 modal 元件，直接吃編輯器裡已經載入好的版本資料，不用另外重新 fetch。
- `StorytellerVersionCompareEntry` 介面支援：
  - `summary?`：故事有摘要、設定集沒有，未定義就不比對摘要段落。
  - `extraFields?: {key,label,value}[]`：內容以外要逐欄比對的簡單文字欄位，Agent 用這個放「AI 供應商」「模型名稱」。
  - `includeFootnotes?`：故事/設定集內容有 wysiwyg 腳注語法要另外拉出來比對；Agent 的 prompt 是純文字，這個關掉。
  - `contentLabel?`：內容欄位標題可換字（Agent 用「Prompt 內容」而不是「內容」）。
- 對話框最上面固定顯示「舊版本 / 新版本」各自的來源＋建立時間（不用點開摺疊區塊才知道在比對哪兩版），且**改成左右對齊**（`justifyContent: space-between`），並各自加上方向箭頭 icon（舊版本前面 `←`、新版本後面 `→`），呼應左右排列。
- 舊的三個獨立頁面（`StoryDiffCompare.tsx`／`LoreDiffCompare.tsx`／`AgentDiffCompare.tsx`）**沒有刪除**，路由也還在，只是新 UI 都已經不再連過去（見下方「保留但已無法從新 UI 導向的頁面」）。

### 4. 嵌入式編輯器（故事／圖像／設定集／資產）

- 四種編輯器（`StoryEditor.tsx`、`ImageEpisodeEditor.tsx`、`LoreEditor.tsx`、資產用 `ProjectWorkspacePreviewRows.tsx` 裡的 `WorkspaceAssetPanel`）在 embedded 模式下的標題列統一抽成共用元件 `WorkspaceEditorHeaderRow`（`ProjectWorkspaceEditorControls.tsx`）：**標題靠左、字數/更新時間/自動存檔狀態等 chip 與存檔按鈕靠右，同一列顯示**，四處排版一致（之前是疊成兩列）。
- `StorytellerShell` 在 `hideHeading` 為 true 且沒有 `action` 時，不再多渲染一段空白列（避免 embedded 模式頂端出現不必要的空白間距）。
- 建立新故事／新圖像／新設定集都可以直接在 workspace 子路由完成（`/my/workspace/:id/story/new`、`/my/workspace/:id/image/new`、`/my/workspace/:id/lore/new`），不用先跳到舊路由。
- 從工作台指定分組建立新項目時，網址帶 `?from=<collectionId>`，讓新項目預設歸進使用者當下瀏覽的那個分組；離開編輯器時的「回列表」／麵包屑／側邊欄高亮也都靠這個參數對回正確分組。
- 直接開啟不存在的 workspace story/image/lore/asset 子路由，或帶一個不存在的 collectionId，右欄會顯示 `<ErrorPage compact backUrl=.../>`（404），不會安靜地顯示空白或「沒有作品」誤導使用者。設定集/資產集因為是後端過濾（帶不存在的 id 會被後端擋成 400），已經統一改成跟作品（純前端過濾）一樣優先判斷「這個分組是否存在」，一律顯示 404，不會因為實作細節不同而 400/404 混雜。
- `ErrorPage.tsx` 新增 `compact` prop（給嵌在右欄等有限寬度容器用，拿掉整頁置中的 70vh 高度與 Container 內距），以及 `backUrl`（有給就顯示「回前頁」+ 返回箭頭，沒給則維持原本「回首頁」）。

### 5. 共用元件抽出

- `WorkspaceChrome.tsx`（新檔）：把原本寫死在 `ProjectWorkspacePreview.tsx` 裡的 `WorkspaceChrome` / `WorkspaceBleedContainer` / `EditorBleedContainer` / `WorkspaceCentered` 抽成獨立檔案，讓帳號工作台（`Home.tsx`）也能共用同一套頂欄與出血容器。`WorkspaceChrome` 新增 `titleDropdown`（要不要做成專案切換下拉選單）與 `showHomeCrumb`（要不要在前面插入「我的工作台 >」這段麵包屑）兩個 prop，讓同一顆元件同時服務「專案工作台」跟「帳號工作台本身」兩種情境。
- `HomeSidebar.tsx` / `HomeCards.tsx` / `homeTabs.ts`（新檔）：把原本塞在 `Home.tsx` 一個檔案裡的側邊欄、專案/Agent 卡片、tab 相關型別與常數拆出來，`Home.tsx` 本身瘦身到 242 行，只負責路由判斷與版面組裝。
- `WorkspaceEditorHeaderRow`（`ProjectWorkspaceEditorControls.tsx`）：見上方「嵌入式編輯器」。

### 6. ErrorPage 插圖（獨立於工作台改版，但同一批工作一起做的）

- 主站（非 SteamLoom 網域）的 `ErrorPage` 插圖原本固定用 `faryne-icon-1024.jpg`，現在改成從 6 張貓娘插圖裡隨機挑一張（`useState` lazy initializer，掛載時抽一次，重新渲染不會換圖）。
- 圖片來源是使用者提供的原始 Discord 附件（1024×1024 webp，單檔 444KB～618KB，檔名是 Discord 附件 ID），已用 Pillow 以 `quality=78` 重新壓縮（維持 1024×1024，單檔降到 66KB～90KB），改名為 `ErrorPage-1.webp` ~ `ErrorPage-6.webp`，移到新的 `static_site/public/error-page/` 目錄下（不再散落在 `public` 根目錄）。
- SteamLoom 網域的 `ErrorPage` 不受影響，仍用原本的織機 icon（`isSteamLoomSite()` 判斷，只認網域，`faryne.dev/storyteller` 巢狀路徑不算）。
- 這個目錄（`public/error-page/`）如果之後還有其他錯誤頁插圖需求，可以延用同一套命名慣例繼續加。

## 目前檔案地圖

- 路由：
  - `static_site/src/App.tsx`
- 專案工作台主體：
  - `static_site/src/pages/storyteller/ProjectWorkspacePreview.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewComponents.tsx`（`WorkspaceSidebar`、`WorkspaceMobileNav`、`WorkspacePane` 等）
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewRows.tsx`（`StoryRow`、`LoreRow`、`AssetCard`、`WorkspaceAssetPanel`）
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewActions.tsx`（各種 mutation/dialog 邏輯，1045 行，見技術債）
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewActionParts.tsx`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewDialogStyles.ts`
  - `static_site/src/pages/storyteller/ProjectWorkspacePreviewTypes.ts`
- 共用工作台外殼：
  - `static_site/src/pages/storyteller/WorkspaceChrome.tsx`（`WorkspaceChrome`、`WorkspaceBleedContainer`、`EditorBleedContainer`、`WorkspaceCentered`）
  - `static_site/src/pages/storyteller/ProjectWorkspaceEditorControls.tsx`（`WorkspaceEditableTitle`、`WorkspaceEditableSummary`、`WorkspaceEditorSelectButton`、`WorkspaceEditorHeaderRow`）
- 帳號工作台：
  - `static_site/src/pages/storyteller/Home.tsx`
  - `static_site/src/pages/storyteller/HomeSidebar.tsx`
  - `static_site/src/pages/storyteller/HomeCards.tsx`
  - `static_site/src/pages/storyteller/homeTabs.ts`
  - `static_site/src/pages/storyteller/NewProject.tsx`（支援 `embedded`）
  - `static_site/src/pages/storyteller/NewAgent.tsx`（支援 `embedded`）
- 既有編輯器（embedded 模式）：
  - `static_site/src/pages/storyteller/StoryEditor.tsx`
  - `static_site/src/pages/storyteller/ImageEpisodeEditor.tsx`
  - `static_site/src/pages/storyteller/LoreEditor.tsx`
  - `static_site/src/pages/storyteller/StorytellerShell.tsx`（`plain`／`hideHeading` 模式）
- 版本比較：
  - `static_site/src/pages/storyteller/StorytellerVersionCompareDialog.tsx`
- 錯誤頁：
  - `static_site/src/pages/ErrorPage.tsx`
  - `static_site/public/error-page/ErrorPage-1.webp` ~ `ErrorPage-6.webp`
- 色系：
  - `static_site/src/data/storytellerTheme.ts`
  - `static_site/src/components/storyteller/SteamPaletteSwitcher.tsx`

## 目前路由總覽（`static_site/src/App.tsx`，`storytellerRoutes`）

```
my                                                  → StorytellerHome（帳號工作台，list）
my/project                                          → StorytellerHome
my/agent                                            → StorytellerHome
my/project/new                                      → StorytellerHome（embedded NewProject）
my/project/:id/edit                                 → StorytellerHome（embedded NewProject）
my/agent/new                                        → StorytellerHome（embedded NewAgent）
my/agent/:agentId/edit                              → StorytellerHome（embedded NewAgent）
my/api-keys, my/usage, my/mcp                       → StorytellerHome

my/workspace/:id                                    → StorytellerProjectWorkspacePreview（專案工作台）
my/workspace/:id/stories/:collectionId
my/workspace/:id/lores(/:collectionId)
my/workspace/:id/assets(/:collectionId)
my/workspace/:id/story/:storyId                     → embedded StoryEditor
my/workspace/:id/image/:storyId                     → embedded ImageEpisodeEditor
my/workspace/:id/lore/:loreId                       → embedded LoreEditor
my/workspace/:id/asset/:assetId                     → embedded WorkspaceAssetPanel

# 舊路由，仍保留但新 UI 已不再導向：
my/project/:id                                      → StorytellerProjectDetail（舊管理頁）
my/project/:id/stories, /images, /lores, /assets     → StorytellerProjectDetail
my/project/:id/story/:storyId                       → StoryEditor（非 embedded）
my/project/:id/story/:storyId/diff                  → StoryEditor（非 embedded，history 側欄）
my/project/:id/image/:episodeId                     → ImageEpisodeEditor（非 embedded）
my/project/:id/lore/:loreId                         → LoreEditor（非 embedded）
my/project/:id/story/:storyId/diff/:diffId1/:diffId2 → StorytellerStoryDiffCompare
my/project/:id/lore/:loreId/diff/:diffId1/:diffId2   → StorytellerLoreDiffCompare
my/agent/:agentId/diff/:diffId1/:diffId2             → StorytellerAgentDiffCompare
```

## 已知技術債／刻意不做的事（不是 bug，請先讀完再動手）

1. **檔案過大**（超過專案慣例的 500 行，皆為既有債務，這次改動只是小幅增量，沒有新造）：
   - `StoryEditor.tsx`：1707 行
   - `LoreEditor.tsx`：1387 行
   - `ProjectDetail.tsx`（舊管理頁，已無法從新 UI 導向）：1320 行
   - `ProjectWorkspacePreviewActions.tsx`：1045 行
   - `ImageEpisodeEditor.tsx`：945 行
   - `NewProject.tsx`：634 行
   - `NewAgent.tsx`：614 行
   - 若之後要動這些檔案的大範圍邏輯，建議先評估拆分（例如 StoryEditor 拆資料 hook／legacy shell／embedded shell／共用 body）。
2. **閱讀頁（`Reader.tsx`，公開頁面）刻意不套用 Notion 風**——已跟使用者確認過，工作台（作者後台）跟公開閱讀頁本來就該是不同視覺語言，不是漏做。
3. **側邊欄不合併**——已評估過「把帳號工作台跟專案工作台的側邊欄合併成一個」的方案並否決，理由是兩者資料形狀差太多（帳號工作台是固定 5 項扁平清單，專案工作台是動態三層樹狀結構含拖曳排序），硬併只會把複雜度從「兩個元件」搬進「一個元件裡的兩套條件分支」，沒有實質簡化；跨情境跳轉需求已經有頂欄「我的工作台」麵包屑處理。
4. **列表分組 chip 沒有去重**——瀏覽單一分組時，該分組底下每一列還是會重複顯示同一個 chip，沒有做「目前就在這個分組所以不顯示」的優化。
5. **手機版 embedded 編輯器沒有逐一驗收**——只驗過帳號工作台（`Home.tsx`）手機版跟工作台整體版面在窄螢幕下的基本呈現，故事/設定集/資產編輯器本身在手機版的操作細節（例如 WYSIWYG 工具列、側欄 tab）沒有特別測試。
6. **保留但已無法從新 UI 導向的頁面**（路由與程式碼都還在，只是沒有任何按鈕/連結會導過去，純粹保留給直接貼網址/書籤相容）：
   - `ProjectDetail.tsx`（舊專案管理頁，`/my/project/:id`）
   - `StoryDiffCompare.tsx`、`LoreDiffCompare.tsx`、`AgentDiffCompare.tsx`（舊版本比較頁，已被 `StorytellerVersionCompareDialog` modal 取代）
   - 如果之後確定完全不需要相容舊連結，這些檔案跟對應路由可以評估整批砍掉，但這次沒有做。
7. **沒有動後端**——這次全部是前端改動，沒有新增/修改任何 API 或 migration。

## 驗證方式

每次改動都跑過（在 `static_site/` 目錄下）：

```bash
pnpm exec tsc -b
pnpm exec eslint <改到的檔案路徑...>
pnpm exec prettier --write <改到的檔案路徑...>
```

功能驗證是用內建的 Browser 工具跑 `pnpm dev` 起本機伺服器，實際點過的流程包括：

- 專案工作台：側邊欄切換分組、冊拖曳排序、麵包屑（含手機版）、專案切換下拉選單、故事/圖像/設定集/資產的建立與編輯（embedded）、版本比較 modal、各種 404（未知 collectionId、未知 story/lore/asset id）、分組 chip 點擊導航。
- 帳號工作台：側邊欄 5 個分頁切換（含手機版收合選單）、建立/編輯專案（含成功後的導向）、建立/編輯 AI Agent、Agent 版本比較 modal、找不到專案/Agent 的 404。
- ErrorPage：主站 404 頁插圖隨機切換、SteamLoom 網域插圖不受影響。

沒有做的驗證：自動化測試（這個專案目前不主動加測試框架，除非使用者要求）、後端 API（本次沒有後端改動）。

## 部署

這批全部是 `static_site/` 前端變動，沒有 Go 後端或 migration，部署只需要：

```bash
make build-frontend
```

不需要 `make build-linux`，也不需要 `make mig-up`。實際部署時機由使用者自行決定，這次的改動都只 commit 到本機 `main`，沒有 push。

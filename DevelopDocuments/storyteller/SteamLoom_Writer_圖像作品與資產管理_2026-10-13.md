# SteamLoom Writer 圖像作品編輯與資產管理（比照網站）規格

- 狀態：已實作（2026-10-13，分支 feat/steamloom-writer-assets，worktree），使用者決定全部比照網站（見文末「實作紀錄」）
- 來源：功能確認時回報的 1、2 項（Writer 無法完成圖像作品、資產無法檢視／刪除／移動）。
- 3～5 項（故事／設定的狀態、冊／設定集、署名可改）已直接實作，見文末。

## 一、圖像作品編輯

### 做法

網站的 `ImageEpisodeEditor.tsx`（1182 行）是整頁元件，綁了 router、登入、react-query，Writer 不能直接用。拆法：

| 抽出成共用 | 說明 |
|---|---|
| `ImageEpisodePageList`（新檔） | 頁面縮圖格、排序、刪除、「頁面描述」對話框（內含網站編輯器，`enabledFeatures=[]`）。純 props：`pages`、`onChange`、`onAdd`、`onPickAsset` |
| `StorytellerAssetPickerDialog` | 改從 `StorytellerEditorDataContext` 取資產清單（新增 `useAssets(project, page, collection, keyword)`），網站行為不變 |

網站 `ImageEpisodeEditor` 改用這兩個共用元件；Writer 用同一組元件＋既有的編輯頁外框＋**同一個存檔 hook**（`useDocumentDraft`，內容就是圖像作品的 JSON 字串，版本衝突／自動存檔／未存檔保護全部沿用）。

### 上傳時機（跟網站不同，建議接受）

- 網站：選圖後先放在本機，按「上傳／儲存」才一次傳 S3。
- Writer：檔案只有 Go 端讀得到（原生選檔視窗），**選完立刻上傳成資產**，再加進頁面清單。
- 代價：選了圖但沒存檔就離開，資產會留在資產庫（可在第二部分的資產管理刪掉）。換來的是不用在 Go 端保存「還沒上傳的本機檔」狀態與預覽，簡單很多。

### 資料

- 讀：`GET /projects/:project/stories/:story/image-pages`（作者端有 `key`、`asset_public_id`、簽名 `image_url`）。
- 存：沿用故事 PUT，`content` 是 `{"pages":[{id,key,asset_public_id,description,sort}]}`；至少要一頁才能存（同網站）。
- Go 新增：`ImagePages(project, story)`；上傳沿用 `UploadAssets`（回傳上傳好的資產）。

## 二、資產管理

### 範圍（比照網站工作台）

- 側邊列的資產集可以點：顯示該資產集的資產（沿用「全部資產」的格狀列表＋分頁）；跟網站一樣多一列「未分類」。
- 資產卡片 ⋮：**移動到資產集**（沒有資產集時停用）、**刪除**。
- 點資產卡片：資產詳細（共用網站的 `WorkspaceAssetPanel`）——預覽、標題／替代文字／說明可改、所屬資產集、檔案資訊；刪除要輸入名稱確認，**仍被作品引用時不能刪**（同網站）。
- 不做：資產集改名／刪除（冊、設定集在 Writer 也還沒有，之後一起做）、替換檔案。

### 做法

- `WorkspaceAssetPanel` 目前在 `ProjectWorkspacePreviewRows.tsx` 裡直接呼叫 API hook；抽成獨立檔，存檔／移動／刪除改成 props（`onSave`、`onMove`、`onDelete`），網站在原處接 react-query，Writer 接 Go 綁定。
- Go 新增：`UpdateAsset`（PUT）、`MoveAsset`（PUT `/move`）、`DeleteAsset`（DELETE）；`Assets` 加資產集篩選。

## 影響檔案

- 網站：`ImageEpisodeEditor.tsx`、新增 `ImageEpisodePageList.tsx`、`StorytellerAssetPickerDialog.tsx`、`StorytellerEditorDataContext.ts`（＋網站實作）、`ProjectWorkspacePreviewRows.tsx` → 新增 `WorkspaceAssetPanel.tsx`
- Writer 前端：`EditorPanel`（圖像作品改走新編輯器）、`ListPanels`（資產集篩選、卡片選單、詳細頁）、`WorkspaceSidebar`（資產集可點）、`lib/editorData.ts`（`useAssets`）
- Writer Go：`internal/api/assets.go`、`app.go`

## 常見失敗與應對

| 情境 | 應對 |
|---|---|
| 上傳到一半有檔案失敗 | 成功的照樣加進頁面，失敗的跳 snack 列出檔名（沿用 `UploadAssets` 的 skipped 回報） |
| 刪除仍被引用的資產 | 按鈕停用並說明（同網站），後端也會擋 |
| 移動／刪除後列表過期 | 操作完重抓列表與側邊列計數 |
| 簽名網址過期 | 圖片網址每次讀取頁面時重新簽；長時間開著的編輯頁沿用 editorData 快取的 30 分鐘時效 |

## 待確認

1. 圖像作品「選完立刻上傳」是否接受。
2. 資產集改名／刪除、替換檔案是否確定先不做。

## 已直接實作：故事／設定的屬性可改（3～5 項）

- 狀態、冊（故事）／設定集（設定）、署名（故事）都改成網站同一組下拉，跟網站一樣是草稿的一部分、按存檔才生效。
- 沒有冊／設定集（只剩未分冊／未歸類）、沒有其他筆名時下拉停用。
- 存檔只帶「這次有改」的狀態／分組／署名（Go `SaveInput` 用指標），沒改的沿用伺服器上的值，避免蓋掉側邊列或網站剛做的變更。
- 切成公開時跟網站一樣提醒「內文連到未公開／已刪除的設定」。
- 側邊列「移動到冊」搬了正在編輯的文件時，編輯頁沒改過分組就跟著更新。

## 實作紀錄（1～2 項，2026-10-13）

使用者決定「資產部分原則上與網站行為一致」，所以跟上面草稿不同的地方：

- **圖像作品改成按存檔才上傳**（同網站，不會留下沒用到的資產）：Go 端用原生選檔視窗選圖、登記成 token（`local_images.go`），預覽走 AssetServer middleware 的 `/local-image/<token>`（dev 模式也會經過 middleware，已驗證）；存檔時 `useDocumentDraft` 的 `prepare` 先呼叫 `UploadLocalImages` 換成資產，部分失敗時保留成功的、重試只傳剩下的。跟網站一樣沒有自動存檔、上傳到未分類。
- **資產集編輯／刪除有做**：網站工作台選到資產集時標題列有編輯（名稱＋用途筆記）／刪除。後端更新資產集會整筆覆寫 sort，Go 端先讀目前的 sort 再送（同網站帶 `target.sort`）。
- **替換檔案沒做**：網站只有舊的專案頁（`project/:id` 的 StorytellerAssetManager）有，工作台沒有；為了跟工作台一致先不做。
- **資產列表**：比照網站工作台，搜尋、重新整理、上傳圖像（上傳到目前的資產集）、卡片 ⋮ 移動／刪除（被引用時停用）、資產集 chip 可點；側邊列多「未分類」。
- 共用元件：`WorkspaceAssetPanel.tsx`（`AssetCard`、`AssetDetailPanel`，存檔／移動／刪除改 props）、`ImageEpisodePageList.tsx`、`StorytellerAssetPickerDialog`（資產清單改從 `StorytellerEditorDataContext.useAssets` 取）、`StorytellerAssetDropzone`（新增 `onPick`，Writer 點擊改呼叫 Go 選檔）。網站沒有資產集時，資產詳細頁的資產集下拉也改成停用（使用者要求的行為，兩邊一致）。
- 編輯頁拆成 `DocumentHeader`（衝突提示、標題、屬性、摘要）＋ `TextDocumentEditor` ／ `ImageDocumentEditor`，未存檔回報與 ⌘S 收進 `useDocumentDraft`。

### 已知差異

- **拖放圖片**：網站拖放區可以拖檔案進來；Writer 目前只能點擊選檔（WebView 拿不到拖進來的檔案路徑，要改用 Wails 的 OnFileDrop），之後再補。
- **上傳進度**：網站有逐頁進度條；Writer 的上傳在 Go 端，目前只顯示不定進度條。

### 驗證

- 網站：`tsc -b`、eslint、prettier、`vitest run src/pages/storyteller`（54）通過。
- Writer：`go vet`、`go test ./internal/api/`、`tsc -b`、build 通過；拿掉 `static_site/node_modules` 模擬 CI 也通過；CI 觸發路徑依相依樹更新（48 條）。
- 實機（worktree 的 dev 實例，本機作者帳號，只做唯讀操作）：全部資產／資產集列表、資產集編輯刪除按鈕、資產詳細頁、圖像作品編輯頁載入頁面、從資產集加入對話框、沒改內容換文件不會問、文字作品編輯頁照常。
- **沒實機測的寫入操作**：資產修改／移動／刪除、資產集編輯／刪除、圖像作品選圖（原生視窗）＋存檔上傳。

## 屬性即時 PATCH（網站＋Writer 統一，2026-10-13）

使用者定義：狀態、冊、署名等屬性欄位一變更就呼叫 PATCH，不寫版本、不進編輯歷史（跟側邊列排序／移動一致），
避免在編輯頁改屬性後按 ⌘S 多出一筆編輯歷史。

- 後端：故事 PATCH 新增 `profile_ids`（改署名、會同步搜尋索引；狀態／冊變動也補上索引同步）；新增 `PATCH /projects/:project/lores/:lore`（`status`、`collection_id`），既有 `/move` 與 MCP `move_lore` 改委派給它。audit：設定 PATCH 帶 `collection_id` 記 `lore.move`，只改狀態記 `lore.update`。
- 網站：StoryEditor／LoreEditor／ImageEpisodeEditor 的屬性改動走 PATCH（失敗就還原並提示）；新建、還沒存過的作品沒有東西可 PATCH，留到第一次存檔一起送。灌表單的 effect 拆成「內容」與「屬性」兩個，PATCH 後 refetch 只更新屬性與已存檔基準裡的屬性（`editorDraftAttributes.ts`），**不會再把作者還沒存的標題／內文重灌掉**（側邊列「移動到冊」原本也有這個問題，一併修好）。
- Writer：`useDocumentDraft.changeAttributes` → Go `PatchDocument`（冊變更時排到該冊最後，跟側邊列一致）；存檔不再帶屬性。
- 設定的「劇透」「依賴」仍跟著存檔一起送（偏內容設定），使用者要的話再改成即時 PATCH。
- 屬性按鈕停用樣式加強（拿掉下拉箭頭、文字與圖示轉停用色、值不加粗），網站沒有冊／設定集、沒有其他筆名時也會停用（獨立頁的下拉一樣）。

驗證：測試帳號（user 4）實打 API——故事改狀態／署名、設定改狀態／設定集，版本數都維持 1；audit 紀錄正確；網站編輯頁打字未存檔時改狀態，內文保留、伺服器版本數不變。

## 列表對齊、圖像作品編輯歷史、側邊列排序（2026-10-13）

- **圖像作品沒有編輯歷史**（使用者定義，網站與 Writer 一致）：Writer 選圖像作品時不顯示「編輯／編輯歷史」分頁列，版本衝突提示也不放「查看編輯歷史」。
- **Writer「全部作品／全部設定」對齊網站**：列改用網站的 `StoryRow`／`LoreRow`（從 `ProjectWorkspacePreviewRows.tsx` 抽到共用的 `WorkspaceDocumentRows.tsx`），標出所屬冊／設定集；右側 ⋮ 用網站的 `WorkspaceRowActionMenu`（作品：設為公開／草稿、移動到冊、刪除；設定：移動到設定集、刪除），刪除要輸入名稱確認。Go 新增 `DeleteDocument`，列表資料補 `group_id` 與圖像作品的 `latest_content`（算頁數）。
- **網站列操作選單拿掉「編輯」**：點列本身就會打開編輯頁；選單也因此不再依賴 router，Writer 可以直接共用。
- **網站側邊列排序比照 Writer**：「調整順序」模式下冊／設定集與冊內作品都顯示上移／下移（共用 `WorkspaceSortArrows`，頭尾不顯示），拿掉拖曳；作品列表的拖曳排序維持現狀（使用者只要求側邊列）。`reorderStory` 多一個分組參數給側邊列指定冊。
- 已知遺留：Writer 的 zh-CN／en／ja／ko 語系檔少了先前「工作台編輯」那一輪只加在 zh-TW 的 52 個 key（畫面目前固定 zh-TW，沒有實際影響）。

驗證：網站與 Writer 型別檢查、lint、build、網站 54 個測試、CI 模擬通過；測試帳號在網站側邊列實測冊與冊內作品的上移／下移，伺服器 sort 正確；Writer 列表、⋮ 選單、圖像作品無分頁列以唯讀方式確認。

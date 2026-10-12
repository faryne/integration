# SteamLoom Writer 圖像作品編輯與資產管理（比照網站）規格

- 狀態：規格草稿，待確認後實作（2026-10-13）
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

# SteamLoom Writer 編輯區（比照網站）規格

- 狀態：規格草稿，待確認後實作（2026-10-12）
- 目標：Writer 的「編輯」分頁從唯讀改成跟網站同一套所見即所得編輯器，右鍵選單、slash 指令、浮動工具列、表格、腳注、註解、程式碼區塊等全部一致。

## 做法：直接沿用網站的 `StorytellerWysiwygEditor`，不重寫

網站編輯器對外只有 `{ value, onChange }` 字串介面，相依樹共 77 個檔案，其中**只有 3 個碰到網站 API／登入**：

| 檔案 | 需要的資料 |
|---|---|
| `StorytellerWysiwygLinkDialog.tsx` | 專案的設定清單（連結到設定） |
| `storytellerLoreLinkCheck.ts` | 專案的設定清單（標示失效的設定連結） |
| `wysiwygCore/assetImageNode.tsx` | 單一資產（圖片預覽網址） |

這 3 個都經由 `apis/storyteller.ts` 彙整檔把整套 API、登入、Firebase 一起帶進來，是唯一的障礙。

### 決策 1：編輯器需要的資料改成注入（建議做）

- 新增 `StorytellerEditorDataContext`，只有兩個 hook：`useLores(projectId)`、`useAsset(projectId, assetId)`。
- 上面 3 個檔案改從 context 取，不再 import `apis`。
- **網站**：在 `StorytellerLayout` 提供（包住所有 storyteller 頁面），實作就是原本的 react-query hook，行為不變。
- **Writer**：用 Go 綁定提供（設定清單沿用 `/lores`；資產用網站既有的 `GET /projects/:project/assets/:asset`，回簽好的預覽網址），自帶簡單快取。

### 決策 2：Writer 的路徑 alias 調整（建議做）

- 目前 Writer 自己的程式用 `@/`，所以被共用的 static_site 檔案**只能寫相對路徑**——編輯器樹裡有 30 個檔案用 `@/`，逐一改相對路徑很髒，之後每次共用都要再改。
- 改成：Writer 自己的程式改用 `@writer/`（機械式取代），`@/` 讓給 static_site（Vite 與 tsconfig 都對到 `static_site/src`）。之後共用網站的元件就不用再動網站的 import。
- 之前為了這個限制改成相對路徑的共用檔案維持原樣即可（相對路徑本來就能用）。
- CI 的觸發路徑改成涵蓋編輯器整棵相依樹（`static_site/src/pages/storyteller/wysiwygCore/**`、`StorytellerWysiwyg*.tsx` 等），清單在實作時依相依樹產生。

## 範圍

### 第一階段（這次）

- **故事與設定**（雙胞胎，行為一致）：標題、摘要（故事）、內文用網站編輯器編輯。
- 頁面外框比照網站編輯頁：標題、狀態列（狀態、冊／設定集、署名在第一階段只顯示）、摘要、底部列（字數、更新時間、自動存檔設定、存檔按鈕）。
- **存檔**：手動存檔＋自動存檔（照作者在網站設定的開關與間隔），帶 `base_version_id`；版本衝突（409）時跟網站一樣提示並提供重新載入。版本來源記成網站的手動／自動存檔（`save_trigger`）。
- **未存檔保護**：切換文件、切到其他分頁、離開專案前，有未存檔內容就先問。
- AI 助理改寫了正在編輯的文件時：沒有未存檔內容就自動載入新版；有的話提示（同網站的衝突提示）。
- 匯出 markdown、語法說明抽屜：網站編輯器內建，直接有。
- 內文裡既有的資產圖片可以正常顯示。

### 第二階段（之後）

- 大綱（TOC）面板、寫作書籤、文字設定（字級／行距）。
- 插入資產（需要資產選擇與上傳：S3 presign 上傳由 Go 端處理）。
- 狀態／冊／署名在編輯頁直接修改（狀態與冊可走這次的 PATCH）。
- 圖像作品編輯器（網站是另一個 `ImageEpisodeEditor`）。

## 影響檔案

- 網站：`StorytellerWysiwygLinkDialog.tsx`、`storytellerLoreLinkCheck.ts`、`wysiwygCore/assetImageNode.tsx`、新增 `StorytellerEditorDataContext.ts`＋網站實作、`layouts/StorytellerLayout.tsx`
- Writer 前端：`vite.config.ts`、`tsconfig.json`（alias）、全部 `@/` → `@writer/`、`pages/workspace/EditorPanel.tsx` 改寫、新增編輯頁外框／存檔 hook、Writer 版的 data provider
- Writer Go：`internal/api`（`SaveStory`、`SaveLore`、`Asset`、`Lores`、使用者自動存檔設定）、`app.go`
- Writer 套件：補齊 TipTap 擴充、`lowlight`／`highlight.js`（版本跟網站一致）
- CI：`steamloom-writer.yml` 的 paths

## 常見失敗與應對

| 情境 | 應對 |
|---|---|
| 存檔時 AI 助理（MCP）剛改過同一篇 | 帶 `base_version_id`，後端回 409 → 提示「內容已被其他地方更新」，提供重新載入；不會靜默覆蓋 |
| 自動存檔途中網路斷線 | 保留畫面上的內容與未存檔狀態，snack 提示，下一輪再試；不會清掉 |
| 切換文件時有未存檔內容 | 先問是否放棄；選取消就留在原文件 |
| 資產預覽網址過期（CloudFront 簽名有時效） | 快取帶時效，過期重新取 |
| 網站共用元件改版後 Writer 編不過 | CI 觸發路徑涵蓋整棵相依樹，網站改到就會跑 Writer 編譯 |
| 編輯器在 macOS WKWebView 的相容性（IME、選取、右鍵） | 實作後實測中文輸入法、右鍵選單、slash 指令；Wails 的原生右鍵要關掉，交給編輯器自己的選單 |

## 待確認

1. 決策 1、2 是否照建議做。
2. 第一階段範圍是否 OK（特別是：狀態／冊／署名先只顯示不給改、插入資產放第二階段）。

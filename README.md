# faryne.dev

這是一個個人側邊專案，使用 Go 語言並基於 [Fiber](https://gofiber.io/) 框架開發。專案整合了 API 服務、資料庫管理、排程任務（Cronjobs）以及前端靜態網站。

## 目錄結構說明

本專案遵循清晰的模組化架構，各目錄功能如下：

- `config`：放置與專案相關的 config 設定資訊（如環境變數定義）。
- `controller`：API 路由的具體實作邏輯。
- `migration`：資料庫遷移檔案（DB migration），目前使用 `sql-migrate` 工具，並區分 `localhost` 與 `master` 環境。
- `model`：定義資料表模型（Entities）或列舉（Enums）等資料結構。
- `repository`：負責資料表操作的程式碼實作（Data Access Layer）。
- `route`：定義專案中的 API 路由路徑與中間件掛載。
- `service`：商業邏輯（Business Logic）的實作層。
- `static_site`：前端網站的原始碼（React/Next.js 等）。
- `docs`：Swagger API 文件與相關說明文件。

## 排程任務 (Cronjobs)

本專案的排程任務定義於 `main.go` 的 `cronjob` 區塊中。開發者可以透過修改該區塊來新增或調整定時任務。

## 開發指令 (Makefile)

本專案提供 `makefile` 以簡化常用操作：

- `make mig-up`：執行資料庫遷移（localhost 環境）。
- `make mig-down`：回滾資料庫遷移（localhost 環境）。
- `make build-linux`：編譯 Linux 版本並同步至遠端伺服器。
- `make build-frontend`：建置前端網站並部署至 Firebase。

## MCP Server

專案提供基本 MCP server 架構，HTTP 服務啟動後可透過 `POST /mcp` 與支援 MCP 的 client 溝通：

```bash
curl -X POST http://localhost:8080/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

目前內建工具：

- `ping`：回傳 `pong`，用於確認 MCP server 存活。
- `av_video_search`：串接 `service/av.VideoSearch`。
- `av_actress_search`：串接 `service/av.ActressSearch`。
- `nekomaid_search`：串接 `service/nekomaid.SearchByRequest`。

## 基礎設施

使用 Docker Compose 提供開發所需的基礎服務：

- **MySQL**: 埠號 `3307`
- **Manticore Search**: 搜尋引擎服務

可透過 `docker-compose up -d` 啟動。

## 注意事項

## 開發環境

- **語言**: Go 1.26+
- **框架**: Fiber v3
- **資料庫**: MySQL (Port 3307), Manticore Search (ES 相容), Redis
- **資料庫遷移工具**: `sql-migrate` (環境：`localhost`, `development`, `master`)
- **主要工具**: 
    - `godotenv`: 載入 `.env` 設定。
    - `cron`: 處理排程任務。
    - `swagger`: 自動生成 API 文件。

## 如何開始

1. 複製 `.env.example` 為 `.env` 並填入必要的設定值。
2. 使用 `go run main.go` 啟動後端服務。
3. 前端網站位於 `static_site` 目錄，請參考該目錄下的說明進行建置。

## 前端多語系（i18n）規則

SteamLoom（storyteller）網站與 SteamLoom Writer 共用一套 i18n 規則（i18next＋react-i18next）。範圍**只限 storyteller**；galgame、萬年曆、`data/navigation.ts` 等其他側專案頁面不做多語系。

### 語系與檔案

- 支援 `zh-TW`、`zh-CN`、`en`、`ja`、`ko`。**`zh-TW` 是基準與 fallback**：新增文案先寫 zh-TW，再補其他四語。
- 網站的翻譯檔放在 `static_site/src/i18n/<語系>/<檔名>.json`，在 `static_site/src/i18n/index.ts` 合併進 `translation` namespace，key 一律寫成「檔名.功能.路徑」，例如 `web.notification.markAllRead`：
  - `web.json`：網站頁面。
  - `writer.json`：網站與 Writer 共用的元件（編輯器、版本比對等）。也可以用 `writer:` namespace 取字，例如 `t("writer:editor.slashMenu")`。
  - `moderation.json`：檢舉與站方處置。
- Writer 自己的頁面放在 `apps/steamloom/writer/frontend/src/i18n/<語系>/*.json`。Writer 會同時載入網站的 `web.json` 與 `writer.json`，所以共用元件用 `web.*` 的 key 在 Writer 裡也讀得到。
- 五個語系的 key 結構必須完全一致，佔位符（`{{name}}`、`<strong>` 等）也要一致。

### 取字方式

- 元件裡用 `const { t } = useTranslation();`，語系切換時會重新渲染。
- 非元件的 helper（在 render 時才呼叫的函式、Tiptap NodeView 等）用 `import i18n from "i18next"` 的 `i18n.t`。
- **不要在模組頂層把翻譯結果存成常數**，否則切換語系後不會更新。設定資料檔（例如 `mcpClientSetup.ts`）裡只存 key，由呈現端用 `t()` 取字。
- 日期與數字依目前語系格式化：`formatStorytellerDate(value, i18n.resolvedLanguage)`、`toLocaleString(i18n.resolvedLanguage)`。不要寫死 `"zh-TW"`。

### 插值與句子

- `{{變數}}` 只用來帶入真正的變數：名字、數量、日期、網址。
- **不要用句子片段拼句子**（例如 `t("delete") + t("story")`，或 `刪除{{target}}`）。日韓文有助詞變化，英文有冠詞與大小寫，拼出來常常不通順。整句寫成一個 key。
- 各語言語序不同時，拆成前綴與後綴兩個 key，空字串就不顯示。例如「以 某筆名 回覆」對應 `web.social.speakAs.prefix`／`suffix`。
- 句子中間夾連結、粗體或程式碼時，用 `<Trans i18nKey="…" components={{ link: <Link …/> }} />`，翻譯檔裡寫 `<link>…</link>`。
- 目前不用 i18next 的複數後綴（`_one`／`_other`）。英文文案寫成不受單複數影響的形式，例如 `Comments · {{count}}`。

### Key 的重用與命名

- 可以重用本來就共用的 key，例如 `web.common.*`（取消、儲存、刪除、載入中…）。
- **不要跨功能借用別區的 key**，例如時間軸不要借 `web.discussion.loadMore`。否則之後改一區的文案，會波及另一區。需要同樣的字時，在自己的功能區開新 key。
- 各頁面各自一個 key、文字剛好相同（例如 `{{count}} 字`）是允許的。各頁用詞之後可能各自調整，不主動合併。
- **中文同字但意思不同的一定要分開**。例如「設定」可能是 Settings 或 Lore，「公開」可能是作品公開範圍或連結可見性。判斷能不能共用時要對照五個語系，不能只看中文。
- 後端給的代碼本身含 `.` 時（例如 audit action `auth.login.failed`），key 把 `.` 換成 `_`，避免和巢狀結構衝突。查不到翻譯時用 `defaultValue` 顯示原始代碼。

### 用語

- 專有名詞不翻：SteamLoom、MCP、OAuth、Personal Access Token、Skill、Token。
- 看板娘「梭梭」：en `Shuoshuo`、ja `シュオシュオ`、ko `슈오슈오`，zh-CN 照用「梭梭」。
- 「設定／設定集」對應英文 Lore／Lore collection；「資產集」的韓文是 `에셋 모음`。
- zh-CN 用中國大陸用語（项目、资产、登录、关注…），不是繁體逐字轉成簡體。

### 刻意不翻的部分

- 程式碼註解、`*.test.ts` 的測試資料。
- `wysiwygCore/commands.ts`、`colorStyles.ts`、`assetImageLayout.ts` 裡的中文：這些是 command registry 的 fallback 與 slash 選單的搜尋別名，顯示時一律走 `writer:editor.*`。
- 站內 AI 助理（目前停用）、`admin/` 後台、`WysiwygDemo` 這類開發用頁面。
- 後端寫進通知 payload 的文字（通知類型名稱、安全通知標題），要多語系得從後端處理。

### 改完要檢查

1. `static_site` 與 `apps/steamloom/writer/frontend` 兩邊都跑 `npx tsc -b`。注意 `tsc --noEmit -p .` 在 project references 模式下不會真的檢查。
2. 在 `static_site` 執行 `pnpm check:i18n`（`scripts/check-i18n.mjs`）。它會檢查五語系的 key 集合是否與 zh-TW 相同、佔位符是否一致，以及程式碼引用的每個 key 在 zh-TW 是否存在。動態 key（`` t(`web.x.${value}`) ``）只檢查 `${` 之前的前綴，實際組出來的完整 key 仍要自己確認。
3. 兩邊都跑一次 `npx vite build`。

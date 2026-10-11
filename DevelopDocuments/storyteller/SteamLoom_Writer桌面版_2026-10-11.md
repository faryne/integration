# SteamLoom Writer 桌面版

- 狀態：第一階段（登入＋列出專案）實作中，2026-10-11
- Branch：`feat/steamloom-desktop-agent`
- 程式碼：`apps/steamloom/writer/`（獨立 go module `faryne.dev/apps/steamloom/writer`）
- Mockup：`DevelopDocuments/storyteller/writer-app-mockup/`

## 定位

作者端的桌面寫作工具。最終目標是 AI 對話區把請求包裝後交給本機已登入的 Codex／Claude Code／Grok Build CLI 執行（用作者自己的訂閱），寫入一律透過 SteamLoom MCP，保留版本與 `base_version_id` 衝突偵測。資料留在站上，Writer 是遠端 client，不是 SQLite 單機版。

## 已確認的決定

- **獨立 app，不做 PWA**：瀏覽器沙箱不能 spawn 本機程序；PWA＋localhost daemon 會碰到 Local Network Access／CORS，而且任何網頁都能打那個 port，資安風險大。
- **Wails v2**：Go main process 直接 `exec` CLI，前端沿用 React＋MUI。
- **放在這個 repo，目錄依「品牌 → 角色」分**：`apps/steamloom/writer`，之後的行動版 reader 放 `apps/steamloom/reader`。要拆 repo 時切線是 SteamLoom 與 faryne.dev，`apps/steamloom/` 整包搬走。
- **獨立 go module**：Wails 需要 CGO＋webview，放進主 module 的話 Linux 上 `go build ./...`／`go vet ./...` 會因為缺 webkit2gtk 失敗。
- **前端共用 static_site 的原始碼**：Vite alias `@steamloom-web` → `static_site/src`，`resolve.dedupe` 強制 React／MUI／emotion 只用 Writer 那份；tsconfig 的 `paths` 也把 `@mui/*`、`@emotion/*` 指向 Writer 的 node_modules。被 Writer import 的 static_site 檔案**只能用相對路徑**，不能用 `@/` alias。
  - 已抽出 `static_site/src/data/storytellerMuiTheme.ts`（`createStorytellerTheme`、`storytellerGlobalStyles`），網站的 StorytellerLayout 也改用它。
- **token 只在 Go 端**：前端透過 Wails 綁定呼叫 Go，Go 帶 Bearer 打 API；token 不進 JS、不需要開 CORS。

## 登入流程（OAuth Authorization Code＋PKCE）

1. Go 在 `127.0.0.1` 隨機埠開 loopback server（RFC 8252 §7.3）。
2. 用這個 `http://127.0.0.1:<port>/callback` 走 DCR 註冊一個 public client。**每次登入都註冊新的**：server 的 redirect_uri 是完全比對，埠號每次不同；沒走完授權的 client 由 server 七天後清掉。
3. 系統瀏覽器開授權頁（同時把網址印到 log），使用者同意後導回 loopback，state 不符的請求直接 400、不算數。
4. 用 code＋verifier 換 token，`{client_id, access, refresh, expires_at}` 存進系統鑰匙圈（service `steamloom-writer`、account 是 issuer，本機與正式站互不干擾）。
5. 呼叫 API 前，access token 剩不到 2 分鐘就 refresh（整段加鎖，避免 rotation 時兩個請求互相作廢）；server 明確拒絕 refresh → 清憑證要求重新登入；API 回 401（例如在網站撤銷授權）也一樣。
6. 登出：先 `POST /oauth/revoke`（失敗不影響），再清鑰匙圈。

## 後端：`/storyteller-client`

- `route/storyteller_client.go`、`controller/storytellerclient/`
- 掛 `storytellerbearer.New()`（OAuth access token 或 PAT），對外是 `https://steamloom.works/api/storyteller-client/...`（走既有的同源 `/api` nginx 規則，不用改 nginx）。
- 不放在 `/storyteller/` 底下：那邊 authenticated 群組的 session middleware 會攔截所有 `/storyteller/*`（同 `/storyteller-mcp` 的理由）。
- 目前端點：`GET /me`、`GET /projects`，回應格式同網頁版對應的 API。
- token 的 resource 綁的是 MCP 網址，但 `Authenticate` 不檢查 resource，所以同一支 token 也能打這組 API。

## 已知 Bug 記錄

1. **授權成功卻停在登入頁**（2026-10-11，已修）
   - 現象：打包版（連正式站）按登入、在瀏覽器完成授權後，主畫面回到登入頁。
   - Root cause：正式站還沒部署 `/storyteller-client`，授權後呼叫 `/me` 拿到 404；當時 Go 的 `Login()` 把「授權」跟「載入作者資料」綁在一起，前端把任何錯誤都當成未登入，錯誤 snack 6 秒後消失，看起來像卡住。token 其實已經存進鑰匙圈。
   - 解法：`Login()` 只負責授權；作者資料由前端用跟啟動時同一個 `loadProfile` 載入，只有 `not_logged_in` 才回登入頁，其他錯誤顯示「無法載入作者資料」＋重試／登出。
   - 狀態：已修，本機驗證過斷線→重試恢復。正式站要等後端部署後才能用。

## 待辦

- 專案主頁：側邊列＋AI 對話／編輯／編輯歷史三個 tab（見 mockup）。
- 本機 CLI adapter（先 Claude Code，再 Codex app-server，Grok 最後）。
- static_site 的 API client 改成可注入（Bearer＋base URL），編輯器等元件才能在 Writer 裡沿用。
- 外觀目前固定 nocturne，之後接 appearance 切換。

## 部署

- 後端：新路由隨主程式部署即可，不需要 migration 或 nginx 變更。**正式站部署前，打包版 Writer 登入後會停在「無法載入作者資料」。**
- Writer：`.github/workflows/steamloom-writer.yml`
  - 觸發：main／PR 動到 `apps/steamloom/writer/**` 或共用的 static_site 檔案才編譯；推 `steamloom-writer-v*` tag 才建 Release（tag 推送不套用 paths 過濾）。
  - 平台：macOS universal（`darwin/universal`）、Windows amd64／arm64（x64 runner 交叉編譯，Windows 版不需要 CGO）、Linux amd64／arm64（各自原生 runner，Ubuntu 24.04 要 `-tags webkit2_41`）。
  - 共用 static_site 檔案清單寫死在 workflow 的 `paths`，Writer 新 import 了 static_site 的檔案要同步補上。
  - CI 只裝 Writer 自己的套件，所以 tsconfig 的 `paths` 要把 `react`、`@mui/*`、`@emotion/*` 指向 Writer 的 node_modules，否則 static_site 檔案的型別會找不到（本機因為 `static_site/node_modules` 存在而不會發現）。
  - 沒有簽名／notarization，`linux-arm64` 依賴 GitHub 的 `ubuntu-24.04-arm` runner。

# SteamLoom Writer 桌面版

- 狀態：v0.1.5 已發佈；登入、專案工作台骨架、版本歷史與本機 AI CLI 純問答已完成，2026-10-12
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

## 後端：沿用網站的 `/storyteller` 路由

- 2026-10-11 起不另開路由群組（原本的 `/storyteller-client` 已移除）：`route/storyteller.go` 的 authenticated 群組改成 `storytellerbearer.Optional()` → `authsession.NewWithBearer()`。
  - 沒帶 `Authorization` 就照舊驗網站 session（X-Encrypt-Key）。
  - 帶 Bearer token（OAuth access token 或 PAT）就驗 token，再轉成 session 形狀，網站 handler 讀 `Session(ctx).UserId` 不用改（盤點過只讀 `UserId`）。token 無效直接 401，不會退回 session。
  - 稽核的 AuthMethod 由 Bearer middleware 設成 oauth／pat，`WebSuccess` 照樣記錄、不會誤記成網站 session。
- **帳號安全相關端點逐條掛 `authsession.SessionOnly()`**，Bearer token 打到回 403（custom code `403301`）：session 續期、刪除帳號、管理後台、OAuth 授權與授權管理、Provider 金鑰、稽核、PAT、站內 AI 的用量與 agent。理由：OAuth 授權頁承諾第三方工具「不能變更帳號設定、刪除帳號、查看或使用 Provider 金鑰／PAT 與其他授權」，也避免拿到 OAuth token 的工具自己生出一把 PAT。**之後新增這類端點要記得掛 `sessionOnly`。**
- Writer 打 `https://steamloom.works/api/storyteller/...`（同源 `/api` nginx 規則，不用改 nginx）。
- token 的 resource 綁的是 MCP 網址，但 `Authenticate` 不檢查 resource，所以同一支 token 也能打這組 API。
- 待確認：Writer 之後透過網站 handler 寫入時，版本來源會記成網站的 `web_manual`／`web_auto`，要不要另外標成 Writer。

## 專案主頁（2026-10-11 骨架）

- Go 端 `Workspace()` 平行抓 5 份清單，在 Go 端依 `parent_id`／`collection_id` 組成樹，前端只負責畫；`Document()`／`Versions()` 以 kind（story／lore）共用同一套路徑，版本列表在 Go 端丟掉內文不傳給前端。
- 側邊列：作品與冊（冊＋未分冊）、設定集（設定集＋未歸類）、資產集（只列名稱）、梭梭的記憶（只列入口）。進入專案自動打開第一篇，所在分組自動展開。
- 三個 tab 都綁「目前選取的那一篇」，故事與設定共用：
  - AI 對話：只有外型（空對話串＋輸入框＋CLI 選單），送出還沒接。
  - 編輯：唯讀，內文用網站 `wysiwygCore/parser.ts` 的 `stripMarkerForDiffLine` 去掉段落／行內 marker 後逐行顯示。
  - 編輯歷史：直接用網站的 `StoryEditHistory`（表格）、`useVersionCompareSelection`（選兩版的規則，網站 StoryEditor／LoreEditor 也改用它）、`StorytellerVersionCompareDialog`（比對視窗），兩邊 UI 一致；Writer 一頁 10 筆（網站側欄 5 筆）。比對時才用 `VersionDetail()` 抓兩個版本的完整內文。還原還沒做。
  - 比對視窗只顯示差異前後 3 行（`customDiff.ts` 的 `collapseUnchangedLines`，上限 5、前後文不計段落間空行、至少 2 行相同才收合），其餘收成「展開 N 行未變更的內容」，網站所有版本比對（故事、設定、Agent prompt）同步生效。
- 已知小問題：`wails dev` 用瀏覽器開 `localhost:34115` 時，console 會出現 Wails 自己 `ipc.js` 的 `Cannot read properties of null (reading 'nodes')`，不影響功能。
- 效能注意：網站的 `stories`／`versions` API 會帶完整內文，專案大的時候側邊列與歷史會慢，之後可能要加輕量版端點。

## 已知 Bug 記錄

1. **授權成功卻停在登入頁**（2026-10-11，已修）
   - 現象：打包版（連正式站）按登入、在瀏覽器完成授權後，主畫面回到登入頁。
   - Root cause：正式站還沒部署 `/storyteller-client`，授權後呼叫 `/me` 拿到 404；當時 Go 的 `Login()` 把「授權」跟「載入作者資料」綁在一起，前端把任何錯誤都當成未登入，錯誤 snack 6 秒後消失，看起來像卡住。token 其實已經存進鑰匙圈。
   - 解法：`Login()` 只負責授權；作者資料由前端用跟啟動時同一個 `loadProfile` 載入，只有 `not_logged_in` 才回登入頁，其他錯誤顯示「無法載入作者資料」＋重試／登出。
   - 狀態：已修，本機驗證過斷線→重試恢復。正式站要等後端部署後才能用。

2. **後端版本對不上時，Writer 把憑證刪掉**（2026-10-11，已修）
   - 現象：開發時 Writer 先改成打 `/storyteller/user`，後端還沒重啟（舊版不收 Bearer）→ 401 `X-Encrypt-Key header is required` → Writer 清掉鑰匙圈憑證，畫面跳回登入頁。
   - Root cause：Writer 把所有 401 都當成「授權被撤銷」。
   - 解法：只有 401 且 `WWW-Authenticate` 帶 `error="invalid_token"`（RFC 6750，storytellerbearer 驗證失敗時會帶）才清憑證；其他 401 只回報錯誤。正式站部署時間差或代理設定錯誤不會把使用者登出。
   - 狀態：已修。

## 待辦

- 專案主頁：編輯器換成網站 WYSIWYG、編輯歷史還原、資產與記憶頁。
- 本機 CLI adapter 已完成第一版（Claude Code／Codex／Grok Build 的 headless 純問答與 session resume）；agentic 化、streaming、MCP tool trace／approval 的研究與分期見 [SteamLoom_Writer_AI助理_2026-10-12.md](SteamLoom_Writer_AI助理_2026-10-12.md)。
- static_site 的 API client 改成可注入（Bearer＋base URL），編輯器等元件才能在 Writer 裡沿用。
- 外觀目前固定 nocturne，之後接 appearance 切換。

## 部署

- 後端：新路由隨主程式部署即可，不需要 migration 或 nginx 變更。**正式站部署前，打包版 Writer 登入後會停在「無法載入作者資料」。**
- Writer：`.github/workflows/steamloom-writer.yml`
  - 觸發：main／PR 動到 `apps/steamloom/writer/**` 或共用的 static_site 檔案才編譯；推 `steamloom-writer-v*` tag 才建 Release（tag 推送不套用 paths 過濾）。
  - 平台：macOS universal（`darwin/universal`）、Windows amd64／arm64（x64 runner 交叉編譯，Windows 版不需要 CGO）、Linux amd64／arm64（各自原生 runner，Ubuntu 24.04 要 `-tags webkit2_41`）。
  - 共用 static_site 檔案清單寫死在 workflow 的 `paths`，Writer 新 import 了 static_site 的檔案要同步補上。
  - 共用檔案 import 的第三方套件（例如 `@mui/icons-material`）要列進 Writer `vite.config.ts` 的 `resolve.dedupe`，否則 CI 的乾淨環境會因為沒有 `static_site/node_modules` 而解析失敗（本機不會發現）。
  - CI 只裝 Writer 自己的套件，所以 tsconfig 的 `paths` 要把 `react`、`@mui/*`、`@emotion/*` 指向 Writer 的 node_modules，否則 static_site 檔案的型別會找不到（本機因為 `static_site/node_modules` 存在而不會發現）。
  - 沒有簽名／notarization，`linux-arm64` 依賴 GitHub 的 `ubuntu-24.04-arm` runner。

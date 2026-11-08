# joyu.fyi 獨立站（AV 搬出 faryne.dev＋女優首頁改版）規格草稿

> 狀態：P1 已實作，待部署。分支 `feat/joyu-fyi`。

## 目標

- AV 功能（女優、影片、主題、上稿）搬到 `joyu.fyi`，faryne.dev 上不再有 AV 頁面。
  - 原因：faryne.dev 是寫在履歷上的個人網站；AV 掛在同一個網域，會影響 SafeSearch 分類和公司網路過濾。
- 結構改成**以女優為主**：首頁就是女優，影片當輔助。
- 整合後台（`faryne.dev/backend_admin`）的 AV 審核**留在 faryne.dev**，不搬。

## 分兩階段

| 階段 | 內容 | 前端 mockup |
|---|---|---|
| **P1 搬家** | 新網域上線、舊網址 301、SEO／SNS／CORS／登入接好。現有頁面原樣搬過去，首頁暫時直接放「女優搜尋列表」 | 不需要（頁面沒變） |
| **P2 女優首頁** | 首頁改版：女優搜尋＋主題入口＋近期新片的女優等版位 | **需要**，先出 mockup 給你確認 |

分開做的理由：P1 改的是基礎設施，出問題容易定位；P2 是 UI 改版，可以慢慢迭代。

## 網址對照（P1）

規則：**拿掉 `/av` 前綴**，只有女優列表例外，直接變成首頁。

| 舊（faryne.dev） | 新（joyu.fyi） |
|---|---|
| `/av/actress` | `/` |
| `/av/actress/:name`、`/av/actress/:name/edit` | `/actress/:name`、`/actress/:name/edit` |
| `/av/actress/topics`、`/av/actress/topics/:slug` | `/actress/topics`、`/actress/topics/:slug` |
| `/av/actress/submit` | `/actress/submit` |
| `/av/video`、`/av/video/:no`、`/av/video/:no/edit` | `/video`、`/video/:no`、`/video/:no/edit` |
| `/av/actress/admin/*` 等舊後台轉址 | 維持轉到 `faryne.dev/backend_admin/av/*` |

- `joyu.fyi/actress`（剛好打到列表）→ 轉到 `/`。
- `www.joyu.fyi` → 301 到 `joyu.fyi`。

## 影響檔案與做法

### 前端（static_site）

- **新增 `helpers/joyu.ts`**：`isJoyuSite()` 和 `joyuPath()`，寫法跟 `helpers/galgame.ts`、`helpers/steamloom.ts` 一樣。
  - 網域清單包含 `joyu.fyi`、`www.joyu.fyi`、Firebase 預設網域，以及本機的 `joyu.localhost`（本機用 `http://joyu.localhost:5173` 測獨立站模式）。
  - 再加一個 `joyuUrl(path)`，給 faryne.dev 上需要連到 joyu 的地方組完整網址（例如後台審核頁的「看影片」連結）。
- **17 個寫死 `/av/...` 的檔案**改用 `joyuPath()`：pages/av/*、components/av/*、helpers/avActress*.ts 等。
- **`App.tsx`**：
  - 新增 `standaloneJoyu` 路由樹（掛在新的 `JoyuLayout`）。
  - faryne.dev 的 `/av/*` 路由整段移除，301 改由 nginx 處理（見下）。
  - 本機開發不走巢狀模式，一律用 `joyu.localhost` 測。
  - App.tsx 已經 977 行，這次順手把 joyu 路由樹抽成 `routes/joyuRoutes.tsx`，避免它繼續長大。
- **新增 `layouts/JoyuLayout.tsx`**：
  - 頁首導覽有女優、主題、影片、登入，不帶 faryne.dev 的外觀。
  - `<meta name="rating" content="adult">` 改成 build 時直接寫進 index.html（`vite-plugins/joyuSite.ts`），不靠 JS。
  - 18 歲確認**維持在各頁面**：確認狀態本來就是全站共用的，搬到 layout 只是重構，沒有實際效益。
- **麵包屑**：一律中文，根節點改成站名（待定，見「待確認」）。
- **`data/navigation.ts`、`pages/Cv.tsx`**：處理方式待你決定，見「待確認」。
- **`pages/backendAdmin/av/video_submission_review.tsx`** 的 `videoPath` 改用 `joyuUrl()`，從後台點出去會開到 joyu.fyi。
- **`firebase.json`**：
  - 新增 hosting target `joyu`。
  - main target 的 `/dmm/*` → `/av/*` 轉址改成直接轉到 joyu.fyi，避免轉兩次。
- **`package.json`**：新增 `deploy:joyu`，Makefile 的 `build-frontend` 也要加進去。

### 後端

- **`config/cors.go`**：前端走同源 `/api`（見決議 6），白名單只補 `https://joyu.fyi` 和 joyu 的 Firebase 預設網域，跟其他站的寫法一致。
- **`service/sns/meta.go`、`av_meta.go`**：照 SteamLoom 的做法加一個 `isJoyuHost` 判斷。
  - nginx 轉給後端時補上 `/av` 前綴，所以現有的 regex 不用改。
  - canonical、og:url 一律指向 `https://joyu.fyi`，路徑不帶 `/av`。
  - 站名和描述換成 joyu 自己的。
  - faryne.dev 的 `pathCollection` 裡 `/av/*` 的通用卡片可以刪掉，因為 faryne.dev 已經不會再渲染 AV 頁面。
- **`service/sns/sitemap.go`**：新增 `JoyuRobotsTxt()`。
  - sitemap **P1 先不做**：女優數量很多，可能要拆成 sitemap index，放到 P2 之後。
  - P1 的 robots.txt 只寫 `Allow`，並擋掉 API 路徑。

### nginx（`httpd_conf/nginx`）

- 新增 `server_name joyu.fyi www.joyu.fyi` 區塊，照抄 steamloom.works 的結構：
  - `@joyu_sns`：社群爬蟲轉給後端 `/sns/av$request_uri`。首頁 `/` 要特別對到 `/sns/av/actress`。
  - `/robots.txt` → `/sns-seo/joyu/robots.txt`。
  - `location /` → `proxy_pass https://<joyu hosting site>.web.app`。
- 80 埠的 server_name 清單加上 joyu，負責 http → https 轉址。
- **faryne.dev 區塊新增 `location ^~ /av/ { return 301 ... }`**。
  - 一定要放在社群爬蟲判斷之前，不然爬蟲拿到的會是 meta 頁，而不是 301。
  - `/av/actress` 剛好打中時轉到 `https://joyu.fyi/`，其他路徑一律拿掉 `/av` 再轉。

## 需要你手動做的（我沒有權限）

1. ~~Firebase hosting~~：已建立獨立專案 `joyu-firebase`，跟主站刻意分開；預設 hosting site 是 `joyu-firebase`（`joyu-firebase.web.app`）。
2. ~~Firebase Auth 授權網域~~：P1 不提供登入（見決議 8），這一步不用做。
3. Cloudflare DNS：`joyu.fyi`、`www` 指向主機，開橘雲，SSL 模式設 Full (strict)。
4. 在 Cloudflare 產生 Origin CA 憑證，放到主機的 `/etc/ssl/cloudflare/joyu.fyi.cert`、`.pem`，然後部署 nginx 設定。
5. Google Search Console：新增 `joyu.fyi` 資源。
   - AV 只是 faryne.dev 底下的一個子路徑，**沒辦法用「網址變更」工具**，只能靠 301 讓 Google 慢慢轉移。

## User stories

- 讀者打開 `joyu.fyi`，第一眼就是女優搜尋，不會看到 faryne.dev 的外觀。
- 讀者從舊書籤或 Google 結果點 `faryne.dev/av/actress/xxx`，會被 301 轉到 `joyu.fyi/actress/xxx`。
- 分享 `joyu.fyi/video/ABC-123` 到 TG／Discord，預覽卡片的網址和站名都是 joyu.fyi。
- 管理者在 `faryne.dev/backend_admin` 審核影片修改，點「看影片」會開到 joyu.fyi。
- 使用者在 joyu.fyi 登入後可以上稿。登入狀態跟 faryne.dev 不共用，要另外登入一次，這是可以接受的。

## 常見 fail 與對應

| 現象 | 原因 | 對應 |
|---|---|---|
| joyu.fyi 呼叫 API 被擋 | CORS 白名單沒加 | `config/cors.go`，或臨時設 `CORS_ALLOW_ORIGINS` |
| 彈出視窗登入失敗，出現 `auth/unauthorized-domain` | Firebase Auth 沒加網域 | console 加上 Authorized domains |
| 社群爬蟲抓舊網址，拿到 faryne.dev 的 meta 卡片而不是 301 | nginx 的 `/av/` location 排在爬蟲判斷之後 | `location ^~ /av/` 要放在 `location /` 前面，而且直接 `return 301` |
| joyu.fyi 連線被直接斷掉 | nginx 預設 server 對沒列名的 Host 一律 444 | 確認 server_name 有列進去 |
| 直接開 `<site>.web.app` 也看得到 AV | Firebase 預設網域關不掉 | `isJoyuSite` 有列進去，canonical 一律指向 joyu.fyi |
| 本機開 `joyu.localhost:5173` 被 Vite 擋下 | allowedHosts 限制 | `vite.config` 補上 `server.allowedHosts` |
| AV 頁面在 faryne.dev 還有殘留連結 | 寫死的路徑沒改乾淨 | 收尾時 `grep -rn "/av/" static_site/src` 確認歸零 |

## 決議（2026-11-08）

1. **站名**：用「joyu.fyi」。
2. **faryne.dev 導覽選單的 AV 項目**：移除。整合後台的 AV 管理功能繼續留在 faryne.dev。
3. **CV 頁上的 AV 專案**：比照第 2 項，從 CV 拿掉。
4. **GA**：共用現有的 property，用 hostname 區分。
5. **footer 不放 faryne.dev 連結**：放了就等於公開兩站是同一個人經營，搬家的切割效果會被抵銷。
6. **API 改走同源 `joyu.fyi/api`**：照 galgame.tv、neko.maid.tw 的做法，建置時 `VITE_API_BASE=https://joyu.fyi/api`，由 nginx 的 `/api/` 轉給後端。這樣瀏覽器的網路請求裡不會出現 faryne.dev。CORS 白名單只補 Firebase 預設網域（`*.web.app` 關不掉，有人會直接開）。
7. **TLS**：照 galgame.tv 的做法，開 Cloudflare 橘雲，主機上掛 CF Origin CA 憑證，SSL 模式設 Full (strict)，不用 Let's Encrypt。
8. **P1 不提供登入**：AV 頁面原本只有「上稿時記錄提交者」（本來就不擋登入）和「管理主題」按鈕用到登入，拿掉的代價很小。joyu 不初始化 Firebase（`lib/firebase.ts`），頁首沒有帳號選單；審核照舊在 faryne.dev 的整合後台做。
   - **之後的方向**：獨立成站後會做社群功能（女優／影片追蹤、資料編輯），屆時接 `joyu-firebase` 的 Firebase Auth。登入資料全部放在 Firebase，自己的 DB 不保存帳號；頂多存新片通知要用的 email 這類資料。到時要另外規劃後端怎麼驗證 joyu-firebase 簽發的 token。

## P1 實作紀錄（2026-11-08）

規格之外的調整：

- **`VITE_SITE=joyu` 的 build 會改寫 index.html**（`vite-plugins/joyuSite.ts`）：站名、描述、canonical、favicon、預覽圖都換成 joyu 的，並**拔掉 AdSense script**。
  - AdSense 不能出現在成人站上，違反政策會連累帳號；publisher ID 也會把兩站連在一起。
  - 已確認 build 出來的 index.html 裡沒有任何 `faryne` 或 `adsbygoogle` 字串。
- **joyu 的圖示和預覽圖**：`public/joyu-icon-*.png`、`joyu-favicon.ico`、`joyu-og-default.jpg`，是用 PIL 產生的暫用版，之後可以直接換檔。
- **主站的「後台管理」入口**原本掛在 AV 女優的導覽項目底下，現在移到「台股 ETF 資訊」的帳號選單。
- **女優主題頁的「管理主題」按鈕拿掉了**：joyu 不提供登入，按鈕永遠不會出現；管理入口在 faryne.dev 的整合後台。
- **舊的後台轉址拿掉了**（`/av/actress/admin/*`、`/av/actress/submissions`、`/av/actress/topics/manage`）：faryne.dev 的 `/av/*` 現在一律被 nginx 301 到 joyu.fyi，這些路由永遠不會被打到。
- **後端 CORS** 在非 production 環境也放行 `*.localhost`，本機才能用 `joyu.localhost` 測。
- **sitemap**：joyu.fyi 的 `/sitemap.xml` 先回 404，避免露出主站的 sitemap，P2 之後再做。
- **MCP 的 AV 工具搬到 `joyu.fyi/mcp`**：`av_video_search`、`av_actress_search`、`av_actress_submit`、`av_actress_submission_status`、`av_video_submit`、`av_video_submission_status`。
  - 後端：`service/mcp/joyu_server.go` 的 `NewJoyuServer()` 只註冊 AV 工具，`NewServer()`（faryne.dev/mcp）拿掉 AV 工具；路由 `POST /joyu-mcp`；CORS 跟其他 MCP 端點一樣維持 `*`。
  - nginx：joyu.fyi 的 `location = /mcp` 改寫成 `/joyu-mcp`。
  - 原因：faryne.dev/tools/mcp 頁面會呼叫 `tools/list` 把工具列出來，AV 工具留在主站等於直接顯示在主站頁面上。
  - **不相容改動**：原本用 `faryne.dev/mcp` 呼叫 av_* 的 MCP client，部署後要改連 `https://joyu.fyi/mcp`。

## 部署順序

**順序很重要**：主站先部署的話，faryne.dev 的 `/av/*` 會在 joyu.fyi 還沒上線前就開始 301 到一個打不開的網域。

1. 手動準備：Cloudflare DNS 加 Origin CA 憑證（見「需要你手動做的」）。Firebase 專案 `joyu-firebase` 已建立。
2. 部署後端：robots 路由、SNS meta、CORS、joyu MCP。
   - 部署後 faryne.dev/mcp 就沒有 av_* 工具了，用 AV 工具的 MCP client 要改連 `https://joyu.fyi/mcp`（第 4 步之後才連得到）。
3. 部署 joyu 前端：`make build-frontend-joyu`。
4. 部署 nginx，**但先不加 faryne.dev 那段 `/av` 301**，只加 joyu.fyi 的 server 區塊。`nginx -t` 後 reload，確認 `https://joyu.fyi/` 正常。
5. 部署主站前端（`make build-frontend`），再加上 faryne.dev 的 `/av` 301，reload nginx。
   - 這一步之後，舊網址就會轉到 joyu.fyi。

## 已知 Bug 記錄

### joyu.fyi 首頁的 index.html 仍是 faryne.dev 的 meta（已修正，2026-11-08）

- **現象**：第一次部署 joyu 前端後，`https://joyu.fyi/` 的原始 HTML 裡，標題、描述、canonical、og:url、og:image、JSON-LD 都還是 faryne.dev 的。只有 favicon、成人內容標記、og:site_name 有換成 joyu 的，AdSense 也確實拔掉了。
- **root cause**：`pnpm build` 在 `vite build` 之後還會跑 `scripts/prerender.mjs`，用寫死的 faryne.dev 標題、描述、canonical、預覽圖、JSON-LD 覆寫 `dist/index.html`，另外還會產生 `/data/rates` 等主站頁面的靜態檔，把 `vite-plugins/joyuSite.ts` 換好的內容又蓋回去。本機測試時是直接跑 `vite build`，沒經過 prerender，所以沒抓到。
- **解法**：`prerender.mjs` 在 `VITE_SITE=joyu` 時直接跳過（4cb4e739）。驗證 joyu build 時要跑完整的 `pnpm build`，不能只跑 `vite build`。
- **狀態**：已修正，重新跑 `make build-frontend-joyu` 部署後生效。
- **備註**：steamloom.works、galgame.tv、neko.maid.tw 的 build 也會跑同一支 prerender，原始 HTML 一樣帶 faryne.dev 的 meta。給社群爬蟲的部分有後端 SNS render 蓋過去，但沒處理到的地方還在，之後要不要處理另外評估。

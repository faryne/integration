# 後端共通：已知 Bug 記錄

不屬於單一品牌（storyteller、galgame、nekomaid…）的後端問題記在這裡，供後續 AI agent 查閱。

## 找不到路由時回 HTTP 200 加上 `"Not Found"` 字串（2026-09-27，已修）

- **現象**：打到不存在的 API 路徑，例如 `GET /storyteller/totally-unknown-route`（已登入）或 `GET /totally-unknown-route`，回應是 `HTTP 200`，body 只有 `"Not Found"` 字串。前端 react-query 會當成成功，`response.data.data` 為 `undefined`，console 出現 "Query data cannot be undefined"。未登入時打 storyteller／galgame 的登入 group 會先被 `authsession` 擋下回 401，所以只有已登入時才看得到這個 200。
- **Root cause**：`main.go` 的 `ErrorHandler` 只對實作 `HttpCode()` 的 `output` 錯誤設定 status。其他錯誤一律 `ctx.JSON(err.Error())`，沒有設 status，所以是 200。Fiber 對沒有對應路由的請求會回傳 `fiber.ErrNotFound`（`*fiber.Error`），就落到這條路徑。同樣的問題也會讓 Fiber 自己產生的 405、413（body 太大）等錯誤回 200。
- **解法**：新增 `output.FromFiberError`。`ErrorHandler` 先把 `*fiber.Error` 轉成標準回應格式並保留原本的 HTTP status，自訂代碼的對應：
  - 404 → `404001`
  - 401 → `401001`
  - 5xx → `500000`
  - 其他 4xx → `400001`
- **影響範圍確認**：
  - 後端不負責 serve SPA 或靜態檔，沒有依賴「回 200」的 fallback。
  - SNS 用明確註冊的 `/sns/*` 路由，不受影響。
  - `/nekomaid/:site` 這類帶參數的路由本來就會命中，不受影響。
- **仍未處理**：handler 直接回傳一般 `error`（不是 `output` 錯誤，也不是 `*fiber.Error`）時，照樣會以 200 回傳錯誤字串。這種情況要改成 500，得先盤點各 controller 有沒有依賴這個行為，另開處理。
- **狀態**：已修（branch `fix/unmatched-route-404`）。

## 台電敦親睦鄰爬蟲：經 Worker proxy 逾時、改版後抓不到資料（2026-10-22，已修）

- **現象**：本機執行 `go run . -cmd taipower-neighbor-range -yearMonthFrom 2026-07 -yearMonthTo 2026-10`，第一個月約 30 秒後 `context deadline exceeded`，整個 range 中止。偶爾連得上時，每個月也都只存進 0 筆。
- **Root cause（逾時）**：`faryne-fetch-proxy.faryne.workers.dev` 解析出兩個 anycast IP。從本機網路連 `172.67.203.167` 會落在 KHH colo，連 `104.21.52.206` 卻被繞到 SEA colo（可透過 proxy 抓 `https://www.cloudflare.com/cdn-cgi/trace` 看 `colo=`）。Worker 在境外 colo 對台電發的 fetch 會整個卡住，等到 Worker 自己的 30 秒 timeout 才回 502 `The operation was aborted due to timeout`，而 Go 端的 timeout 也是 30 秒，所以會先看到 client 端逾時。Go 的 HTTP/2 連線會被重用，一旦連到壞的 IP，同一個 process 裡的後續請求全部失敗。台電原站從本機直連只要 0.3～1.5 秒，跟程式本身無關。
- **Root cause（0 筆）**：台電改版。表格從 11 欄變成 10 欄（項次、核准日期、縣市鄉鎮區、單位、活動名稱、起、迄、地點、金額、理由），而且改成每頁 30 筆、用 `pn` 分頁（`pn` 超過最末頁會停在最末頁，不會回空頁）。舊 selector 欄位錯一格，`cityarea` 抓到單位名稱，被 `isValidCityArea` 全部濾掉。
- **解法**：
  - `crawler.CrawlByURLInTaiwanWithTimeout`：`CF_WORKER_PROXY_URL` 留空就直連目標站。本機在台灣時把它清空即可，prod 照舊走 proxy。
  - `taipower.fetchNeighborPage`：單次 timeout 改成 15 秒，最多 3 次，重試前 `http.DefaultClient.CloseIdleConnections()` 讓下一次重新 dial。走 proxy 時這只是機率性的緩解。
  - selector 改成新版 10 欄；從 `#result`（「第 1 / 7 頁」）解析總頁數，逐頁抓取。
  - `CrawlRange`／`Backfill` 共用 `crawlMonths`：單月失敗只記 log 並繼續，最後用 `errors.Join` 一起回報。
- **仍未處理**：Worker 落在境外 colo 的問題本身沒解，prod 若從會被繞到境外 colo 的網路打 proxy，一樣會卡住。要根治只能在 Worker 端處理（例如偵測 `request.cf.colo` 不在台灣就快速失敗，或改用固定在台灣的出口）。
- **狀態**：已修（branch `fix/taipower-neighbor-proxy-timeout`）。

## 分享預覽：平台照 og:url 重抓後拿到通用卡（2026-10-24，已修）

- **現象**：用 Facebook 分享偵錯工具測 `https://faryne.dev/data/vtubers/@moricalliope/videos/V9Evq2RBJ2A`，第一次抓的網址回應正確，但 FB 照 `og:url` 重抓，重新導向路徑變成「輸入網址 → `/sns/data/...` → `/sns/sns/data/...`」，最後的預覽是站台通用卡（標題 `ha2.tw / faryne.dev`）。不是 vtuber 專屬：ETF（`/sns/data/etf/twse/0050`）、匯率等主站頁面也一樣。SteamLoom 的 `og:url` 本來就指向 canonical，不受影響。
- **Root cause**：
  - 主站的 `og:url` 指向 `/sns/<path>`。爬蟲照它重抓時，nginx 依 UA 又把請求轉給後端，多補一層 `/sns`，handler 的 `Params("*")` 拿到 `sns/data/...`（沒有開頭斜線）。
  - `normalizeFrontendPath` 只做一次 `TrimPrefix("/sns")`，對沒有開頭斜線的 `sns/...` 不起作用，路徑變成 `/sns/data/...`，比對不到任何頁面，回通用卡，`og:url` 也變成 `/sns/sns/...`。
  - 另外，路徑沒有先解碼：有些平台會把 `@` 送成 `%40`，`/data/vtubers/%40name` 查不到藝人回 404，影片頁的 `og:url` 則被編碼成 `%2540`。
- **解法**：`normalizeFrontendPath` 先 `url.PathUnescape`，`path.Clean` 之後把開頭的 `/sns` 段全部剝掉（只比對整段 `/sns`、`/sns/…`，`/snsfoo` 不受影響）。重抓 `/sns/sns/<path>` 會拿到跟原網址相同的 meta，`og:url` 指回 `/sns/<path>` 本身，平台的重新導向鏈就此停止。測試在 `service/sns/meta_test.go` 的 `TestNormalizeFrontendPath`、`TestBuildMetaRefetchViaOpenGraphURL`。
- **仍未處理**：主站 `og:url` 要不要比照 SteamLoom 改成 canonical（讓讚數與分享數歸到真正的網址），尚未決定；這次只修讓 meta 正確。
- **狀態**：已修（branch `fix/sns-path-normalize`）。部署後要在 FB 分享偵錯工具按「再次抓取」更新快取。

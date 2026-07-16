# 消防即時出勤記錄抽離獨立 Docker Image 工作卡

範圍：把「消防即時出勤記錄」前後端功能抽離成獨立 Docker image，儘可能精簡、不吃資料庫、不依賴外部資源。

**狀態：[DONE]**，已完成獨立成新 repo：`/Users/faryne/projects/sideproject/tw-fire-realtime`（本機路徑，尚未推 remote）。這份文件保留當時的調查與決策紀錄，之後的變更請直接看新 repo 的 [README](../../../tw-fire-realtime/README.md) 跟程式碼。本 repo（`faryne.dev`）除了前面已完成的卡 4（搬 `http.go`）以外，沒有其他程式碼變動。

## 現況調查記錄

- 可抽走的範圍：route `/opendata/fd/realtime_events`、`/opendata/fd/realtime_events/:area`（[route/opendata.go:24-25](../../route/opendata.go)）、controller `FDRealtime`/`FDRealtimeByArea`（[controller/opendata/ntpcfd.go](../../controller/opendata/ntpcfd.go)）、整個 [service/fire_department/](../../service/fire_department) package。這條資料流本身完全不吃 DB。
- 不能一起抽的：`/opendata/fd`、`/opendata/fd/units`（`FetchNtpcFDEvents`/`FetchNtpcFDUnits`）吃 MySQL `ntpcfd`/`ntpcfd_units` table（[repository/ntpcfd/ntpcfd.go](../../repository/ntpcfd/ntpcfd.go)），是歷史查詢功能，跟即時出勤是不同資料流，名稱相近但要切開，不在這次範圍內。
- 前端只有一頁 [firedepartment_realtime.tsx](../../static_site/src/pages/opendata/firedepartment_realtime.tsx) + 一支 hook [apis/opendata/firedepartment.ts](../../static_site/src/apis/opendata/firedepartment.ts) + type 檔，沒有跟 auth/storyteller 等其他模組糾纏。
- Redis cache 只是加速用（90s TTL），`client.GetRedis` 拿不到就直接跳過（[realtime.go:135-153](../../service/fire_department/realtime.go)），不影響正確性，可以拔掉換成 in-memory。
- `main.go` 全站開機時強制連 MySQL + ES（ES 連不到會直接 panic），這是全站共用 bootstrap，跟這個功能無關，代表**不能沿用現有 `main.go` 當 entrypoint**，要另開 slim entrypoint。
- 抓資料用純 HTTP + goquery 解析 HTML（[service/crawler/function.go](../../service/crawler/function.go)），**沒有 headless Chrome 依賴**，image 不用裝 Chrome。
- 原本 11 縣市中有 6 個（基隆、宜蘭、苗栗、雲林、台南、高雄）透過 `CrawlByURLInTaiwanWithTimeout` 打自架的 Cloudflare Worker proxy 取台灣 IP 繞地理限制。

## 討論後拍板的決策

1. **拿掉 CF Worker proxy 依賴**：6 縣市的 `CrawlByURLInTaiwanWithTimeout` 全部改成跟其他縣市一樣的 `CrawlByUrlWithTimeout`，不再需要 `CF_WORKER_PROXY_URL/SECRET`。前提是部署環境本身要在台灣（IP 是台灣即可），這件事由拉這個 image 的人自行確保。11 縣市統一走直連，達成零外部資源。
2. **不考慮併發/cluster**：正常狀況只會啟動一個 instance，沒有多副本需求。Cache 直接用最簡單的 in-memory（`struct + sync.Mutex + timestamp` 或 `sync.Map`）即可，不用落地檔案，不用考慮跨副本一致性。
3. **「沒想到的點」收斂**：rate limit、ToS/授權、healthcheck 細節等都不是要考慮的問題——前後端跑在其他網域/機器上，跟現在的環境無關，由拉下來的人自行負責、自己加設定處理（例如：多久 refresh 一次頁面）。唯一真的要放在心上的是：**上游網站改版會讓 crawler 掛掉，需要出新版 image**，這件事沒法自動化，只能靠人盯著。
4. **獨立 repo，最後決定不用 submodule**：方向是另開一個獨立 repo 放這個 image 的程式碼，前端也在這個新 repo 裡（不放回 `static_site`，避免拖進 Firebase/auth/storyteller 等無關依賴）。原本考慮把 `faryne.dev` 當 git submodule 掛進新 repo 直接 import，但動工前發現：真正能原封不動重用的只有 `service/crawler` 通用邏輯 + `Event` 型別 + `Taipei()`/`NewTaipei()` 兩支直連 API；其餘 9 個縣市因為要拿掉 Redis cache（寫死在 `realtime.go`，沒有注入點）跟拿掉 CF proxy（寫死在各城市檔案裡，且解析邏輯 `crawlDataTableCases` 是未導出函式，submodule 外部叫不到），本來就得重寫，submodule 能省的量很有限。最後決定新 repo 完全獨立複製（含 crawler 邏輯），不設 submodule，換取部署/建置流程單純。

### `service/client` 依賴問題：已完成重構 [DONE]

確認過 `service/client/http.go` 整支只用 stdlib（`encoding/json`/`io`/`net/http`/`net/url`），本身沒有 DB/Redis/ES 依賴。問題純粹是它跟 `mysql.go`/`redis.go`/`elasticsearch.go` 同屬 `client` package——Go 以 package 為編譯單位，import 到 `client.DoRaw` 就會把整個 package（含 gorm、go-redis、elasticsearch client 等 top-level import）一起編進 binary。

也考慮過另開一個全新的 `service/http` package，但確認 `service/helper` 現有的 `paginate.go` 只依賴 `model/entity`（純 struct，gorm 只是 tag 字串，沒有真的 import gorm 套件）+ fiber，用 `go list -deps ./service/helper/...` 實測完全沒有 gorm/elasticsearch/go-redis，本身就乾淨，不需要為此再開新 package。

**已執行**：把整支 `service/client/http.go`（`DoRequest`/`Do`/`DoWithHeaders`/`DoRaw`/`DoRawWithStatus`）搬到 [service/helper/http.go](../../service/helper/http.go)，`service/client/http.go` 已刪除。5 個呼叫點的 import 已改成 `faryne.dev/service/helper`：
- [service/discord/index.go](../../service/discord/index.go)
- [service/crawler/function.go](../../service/crawler/function.go)
- [service/dmm/client.go](../../service/dmm/client.go)
- [service/fire_department/index.go](../../service/fire_department/index.go)
- [service/thread/oembed.go](../../service/thread/oembed.go)

`go build ./...`、`go vet ./...`、以及這幾個 package 的既有測試（`fire_department`、`crawler`、`discord`）都跑過確認通過。重構後再次用 `go list -deps ./service/helper/...` 確認仍然乾淨。

完成這個重構後，`service/fire_department` → `service/crawler` → `service/helper.DoRaw` 這條 import 鏈已經不會再牽到 gorm/go-redis/elasticsearch-client，submodule 方案可行的前提已經成立。

## 工作卡（全部 [DONE]，實作內容在 `tw-fire-realtime` repo）

### 卡 1：Backend slim entrypoint [DONE]
- 新 repo 根目錄 `main.go`（`package main`，沒有分 `cmd/` 子目錄，單一 binary 專案不需要），只掛兩支 route + `/healthz` + 基本 logger/recover/cors middleware，不初始化 MySQL/ES
- Config 只有 `APP_PORT` 一個環境變數，沒有整包 `envConfig`

### 卡 2：Cache 換成 in-memory [DONE]
- 新 repo的 `cache.go`（簡單 `map + sync.RWMutex + TTL`）+ `realtime.go`（`singleflight` 防併發重抓），行為對齊原本 90 秒 TTL，拔掉 Redis 依賴

### 卡 3：拿掉 CF Worker proxy [DONE]
- 新 repo 的 `crawler.go` 只有一個 `crawlByURLWithTimeout`，沒有 InTaiwan 變體，9 個 data-table 縣市（[data_table.go](../../service/fire_department/data_table.go) 邏輯搬過去後）跟 2 個直連 API 縣市全部直接打原站，沒有任何 proxy 程式碼

### 卡 4：搬移 `service/client/http.go` → `service/helper/http.go` [DONE]
- 動主 repo：搬檔案、改 5 個呼叫點的 import path（見上方「已完成重構」）
- 純粹搬家不改行為，已完成並跑過 build/vet/test 驗證

### 卡 5：獨立 repo 建置 [DONE]
- 新 repo：`tw-fire-realtime`，決定不用 submodule（見上方「最後決定不用 submodule」）
- 前端 `web/` 下另開輕量 Vite + React 專案，port `firedepartment_realtime.tsx` 邏輯，拿掉 react-router（改用 local state 切換縣市）跟 Firebase
- API 改走 relative path（前後端同源），拿掉 `VITE_API_BASE`；本機開發用 vite dev server proxy 打 8080

### 卡 6：Dockerfile [DONE]
- Multi-stage：`node:22-slim` build 前端 dist → `golang:1.25-alpine` go build（`go:embed all:web/dist`）→ `gcr.io/distroless/static-debian12:nonroot`
- 實測 image 13.4MB，`docker run` 起來後 healthz/前端頁面/11 縣市 API 都驗證過有真實資料
- 有個容易漏掉的坑記錄一下：distroless 沒有系統 tzdata，`time.LoadLocation("Asia/Taipei")` 在 scratch/distroless 會直接失敗，要在 `main.go` blank import `_ "time/tzdata"` 把時區資料庫編進 binary

## 驗證紀錄

- `go build`/`go vet`/`gofmt` 全過
- 本機以 `go run .` 起服務，11 縣市 API 都拉到即時真實資料（含需要台灣 IP 的 6 個縣市，在這台開發機上也正常，不代表所有部署環境都適用，仍要照 README 提醒部署在台灣）
- 前端在 Browser pane 驗證：頁面渲染、縣市 chip 篩選、關鍵字搜尋、無 console error
- Docker image build + run 驗證：healthz、前端靜態頁、API 都正常回應

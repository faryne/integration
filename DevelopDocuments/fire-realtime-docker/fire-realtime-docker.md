# 消防即時出勤記錄抽離獨立 Docker Image 工作卡

範圍：把「消防即時出勤記錄」前後端功能抽離成獨立 Docker image，儘可能精簡、不吃資料庫、不依賴外部資源。評估用，尚未排入實作。

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
4. **獨立 repo，考慮把 `faryne.dev` 當 git submodule 引入**：方向是另開一個獨立 repo 放這個 image 的程式碼，前端也在這個新 repo 裡（不放回 `static_site`，避免拖進 Firebase/auth/storyteller 等無關依賴）。Backend 部分考慮把目前這個 `faryne.dev` repo 當 submodule 掛進新 repo，直接 import `faryne.dev/service/fire_department` 等 package，不用複製貼上。

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

### submodule 操作面（仍待確認)

- 新 repo 的 `go.mod` 需要 `replace faryne.dev => ./vendor/faryne.dev`（或 submodule 掛載路徑）+ `require faryne.dev v0.0.0-...`；CI/build 時需要能拉到這個 submodule（若之後 `faryne.dev` repo 設為 private，要處理 checkout 認證，例如 deploy key）。
- 主 repo（`faryne.dev`）之後若重構 `service/fire_department` 或 `service/crawler`，submodule pointer 不會自動跟著動，需要手動 bump commit + 重新 build image，這是 submodule 方案本身的正常代價，先記錄起來，不算阻礙。

## 工作卡

### 卡 1：Backend slim entrypoint
- 新 repo 開 `cmd/fire-realtime/main.go`（或直接就是新 repo 的 `main.go`），只掛 fire realtime 兩支 route + 基本 logger/recover middleware，不初始化 MySQL/ES
- 決定 config 怎麼帶：大概只需要 `APP_PORT` + refresh interval 之類的自訂參數，不用整包 `envConfig`

### 卡 2：Cache 換成 in-memory
- [service/fire_department/realtime.go](../../service/fire_department/realtime.go) 目前的 `getCachedRealtimeEvents`/`cacheRealtimeEvents` 系列函式改成 in-memory 實作，拔掉 `client.GetRedis` 依賴

### 卡 3：拿掉 CF Worker proxy
- [ilan.go](../../service/fire_department/ilan.go)、[kaohsiung.go](../../service/fire_department/kaohsiung.go)、[keelung.go](../../service/fire_department/keelung.go)、[miaoli.go](../../service/fire_department/miaoli.go)、[tainan.go](../../service/fire_department/tainan.go)、[yunlin.go](../../service/fire_department/yunlin.go) 六個檔案的 `Crawl: crawler.CrawlByURLInTaiwanWithTimeout` 改成 `crawler.CrawlByUrlWithTimeout`（或乾脆拿掉這個欄位用預設值）

### 卡 4：搬移 `service/client/http.go` → `service/helper/http.go` [DONE]
- 動主 repo：搬檔案、改 5 個呼叫點的 import path（見上方「已完成重構」）
- 純粹搬家不改行為，已完成並跑過 build/vet/test 驗證

### 卡 5：獨立 repo 建置
- 開新 repo，決定要不要用 submodule 掛 `faryne.dev`（依卡 4 結論）
- 前端另開輕量 Vite + React 專案，搬 `firedepartment_realtime.tsx` 邏輯過去，拿掉 react-router（單頁不需要）、Firebase 等無關依賴
- `VITE_API_BASE` 這種 build-time env 在單一 image 情境不方便，改用 relative path（前後端同源、同一個 binary 用 `embed.FS` 服務）或 runtime config

### 卡 6：Dockerfile
- Multi-stage：node build 前端 dist → go build（`embed.FS` 塞進 dist）→ `distroless/static` 或 `scratch`
- 確認最終 binary 沒有意外 link 到 gorm/ES/redis（呼應卡 4）

## 建議順序

卡 4（[DONE]）→ 卡 1/2/3（backend 精簡，可平行）→ 卡 5（獨立 repo + 前端）→ 卡 6（Docker 收尾）。卡 4 雖然改動小，但是 submodule 方案能不能乾淨可行的前提，已經排最前面做掉了。

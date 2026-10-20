# SteamLoom Writer Media Worker 擴充機制規格

- 狀態：規格草稿，待使用者確認（2026-10-20）
- 目標：定義公開的 Go interface，讓 repo 外的開發者自行開發 Media Worker，透過**編譯期註冊**加入 Writer。
- 方向（已定案）：兩條路並行 ——
  1. **官方收錄（主要）**：作者發 PR 把自己的 module 加進收錄清單，審過後隨正式版發佈，所有使用者都拿得到、self-update 不受影響。
  2. **本機編譯（開發工具）**：開發者在本機把自己的 module 編進 Writer 測試；產物標記為自訂版並停用 self-update。
- 模式參考：Caddy（`xcaddy`）、CoreDNS（`plugin.cfg`）——plugin 在 `init()` 註冊，主程式用 blank import 帶入。
- 不在本規格範圍：out-of-process plugin、capability 詞彙表、外部 Worker 的多語系 label、產物 symlink／MIME 嚴格驗證。這些另案處理，見文末「另案」。

## 一、架構

```
github.com/alice/steamloom-comfy          ← 第三方 module，只依賴 workerkit
  └─ import faryne.dev/apps/steamloom/workerkit

apps/steamloom/workerkit/   （獨立 go.mod，零外部依賴）
  ├─ interface：Adapter、Generator、ExecutionPolicyProvider、CatalogResolver
  ├─ 型別：AdapterDescriptor、SettingField、JobField…、GenerateRequest、GenerateResult…
  ├─ Register(Module)／Modules()
  └─ helper：DownloadImage、ParseEndpoint

apps/steamloom/writer/      （Writer module）
  ├─ workers.cfg            ← 官方收錄清單（commit）
  ├─ workers_gen.go         ← genworkers 產生的 blank import（commit）
  ├─ workers.local.cfg      ← 本機開發清單（gitignore）
  ├─ workers_local_gen.go   ← 本機產生（gitignore）
  ├─ go.work                ← 本機產生（gitignore）
  ├─ cmd/genworkers/        ← 產生器
  └─ internal/mediaworker/  ← Service、驗證、store、vault（不公開）＋內建 adapter
```

plugin **不可** import Writer module：會拖進 wails／keyring 依賴，且 Writer 反向 import plugin 會形成 module 循環。所以 SDK 必須獨立成 module。

## 二、workerkit SDK

### 搬出 `internal/mediaworker` 的內容

| 搬到 workerkit（公開） | 留在 internal（不公開） |
|---|---|
| `Adapter`、`Generator`、`ExecutionPolicyProvider`、`CatalogResolver` | `Service`、`Registry` 實作 |
| `AdapterDescriptor`、`SettingField`、`JobField`、`JobOption`、`JobFieldCondition`、`JobItemNumber`、`JobWeightedSelection` | `Worker`、`SaveInput`（設定頁的 instance 資料） |
| `Discovery`、`GeneratedArtifact`、`GenerateResult`、`ExecutionPolicy`、`DefaultExecutionPolicy`、`RequestAudit`、`CatalogItem` | `storedWorker`、`fileStore`、`secretVault` |
| 已知 capability 常數（`CapTextToImage = "text_to_image"` 等，只是把現有字串變成常數） | `validateJobSchema`、`validateJobInput`、`validateCatalog` |
| `DownloadImage`（現 `downloadImage`）、`ParseEndpoint`（現 `endpoint`） | `fetchJSON` 等只有內建用到的小 helper |

### 公開前順手改的簽章

`Generate` 現在是 `Generate(ctx, settings, secrets, inputs, root)`，一公開就凍結，之後要加參數會讓所有 plugin 編譯失敗。改成 struct：

```go
// GenerateRequest 是 Writer 交給 adapter 的單次 job；之後新增欄位不影響既有 plugin。
type GenerateRequest struct {
	Settings  map[string]string // 非敏感設定
	Secrets   map[string]string // 只在這次呼叫存在
	Inputs    map[string]any    // 已依 JobFields 驗證並套用預設值
	OutputDir string            // 產物只能寫在這裡
}

type Generator interface {
	Capabilities(settings map[string]string) []string
	JobFields(settings map[string]string) []JobField
	Generate(context.Context, GenerateRequest) (GenerateResult, error)
}
```

`Discover` 同理改成 `Discover(ctx, DiscoverRequest{Settings, Secrets})`。其餘 interface 維持原樣。

### 註冊

```go
// Env 是 Writer 注入給 adapter 的執行環境，plugin 不自己建 http.Client。
type Env struct {
	HTTPClient func(timeout time.Duration) *http.Client
}

type Module struct {
	ID           string            // 必須與 Descriptor().ID 相同
	New          func(Env) Adapter
	Experimental bool              // true 只在 dev 版註冊，取代 defaultAdapters(dev) 的寫死判斷
}

// Register 在 plugin 的 init() 呼叫；ID 空白或重複直接 panic（同 database/sql），編譯完一啟動就會發現。
func Register(m Module)

// Modules 依 ID 排序回傳所有已註冊 module，給 Writer 建 Registry 用。
func Modules() []Module
```

- `internal/mediaworker.NewDefault` 改成：讀 `workerkit.Modules()` → 過濾 `Experimental && !dev` → `m.New(env)` → 檢查 `Descriptor().ID == m.ID` → `NewRegistry(...)`。
- 內建 PixAI／fal／ComfyUI／SD WebUI 也改用 `init()` + `workerkit.Register`，`defaultAdapters()` 刪除。內建與外部只有一條路徑。
- **ID 規則**：內建維持現有短 ID（`pixai`、`fal`、`comfyui`、`sdwebui`；workers.json 已存的 `adapter_id` 不能變）；外部一律 reverse-domain（`dev.alice.comfy`），收錄時 review 把關。

### 發佈 SDK

- module path 維持 `faryne.dev/apps/steamloom/workerkit`，在 faryne.dev 後端（Fiber）加 `?go-get=1` handler 回 `go-import` meta，導向 `github.com/faryne/integration`。目前 `faryne.dev` 沒有這個 meta，外部 `go get` 會失敗。
- 版本 tag 用 nested module 慣例：`apps/steamloom/workerkit/v0.1.0`。alpha 期間維持 v0，允許破壞性變更，在 workerkit README 寫明。
- Writer 自己用 `replace faryne.dev/apps/steamloom/workerkit => ../workerkit`，SDK 與 Writer 同 commit 改動不必先發 tag。

## 三、編譯整合（genworkers）

### 清單格式

不引入 yaml 依賴，用 CoreDNS `plugin.cfg` 式的純文字，一行一個：

```
# workers.cfg：官方收錄的 Media Worker；改這份後執行 go generate
github.com/alice/steamloom-comfy v0.2.1
```

```
# workers.local.cfg：只在本機生效（gitignore）；右邊是本機路徑
github.com/me/my-worker ../../../../my-worker
```

### genworkers 行為

`main.go` 加 `//go:generate go run ./cmd/genworkers`，執行時：

1. 讀 `workers.cfg`：對每行 `go get module@version`，產生 `workers_gen.go`（`package main`，只有 blank import），最後 `go mod tidy`（移除的 plugin 才會從 go.mod 消失）。
2. `workers.local.cfg` 存在時：產生 `go.work`（`use .`＋每個本機路徑）與 `workers_local_gen.go`（blank import＋`func init() { customBuild = true }`）；不存在時刪掉這兩個檔，回到乾淨狀態。
3. 同一個 module 不可同時出現在兩份清單。

`workers_gen.go`、`go.mod`、`go.sum` 都 commit，所以一般 `wails build` 不必先跑 generate。

### CI

`steamloom-writer.yml` 在 Build 前加一步 drift 檢查：

```bash
go generate ./... && git diff --exit-code -- workers_gen.go go.mod go.sum
```

有人改了 `workers.cfg` 卻忘了 generate，CI 直接失敗。

### 自訂版停用 self-update

- `customBuild` 為 true 時：`CheckForUpdate`／`InstallUpdate` 直接回「自訂版不支援自動更新」，關於頁顯示「自訂版（含本機 Worker）」。
- 理由：self-update 會用官方版覆蓋執行檔，本機編進去的 Worker 會無聲消失。

## 四、User Story

### Plugin 作者：從開發到被收錄

1. `go get faryne.dev/apps/steamloom/workerkit@v0.1.0`，實作 `Adapter`＋`Generator`，在 `init()` 呼叫 `workerkit.Register`。
2. clone faryne/integration，在 `apps/steamloom/writer/workers.local.cfg` 寫一行指向自己的目錄，`go generate`，`wails dev`。
3. 設定頁「新增 Worker」看得到自己的 adapter，填設定、測試連線，在對話中讓 Agent 提 `media.brief` 並實際生成。
4. 發 tag `v0.1.0`，對 faryne/integration 發 PR：`workers.cfg` 加一行，執行 `go generate` 後 commit `workers_gen.go`／`go.mod`／`go.sum`。
5. 維護者 review plugin 原始碼（同 process，可讀到 Keychain，見「常見失敗」），合併後隨下一版 Writer 發佈。

### 維護者：收錄與升版

- 收錄：審 PR 時同時看 plugin repo 對應 tag 的原始碼；`go.sum` 鎖住內容，tag 被改寫也會在 build 時失敗。
- 升版：plugin 作者發新 tag 後再發 PR 改版本號；**不自動追最新版**。
- 下架：從 `workers.cfg` 移除。使用者已存的 Worker 設定不會刪，設定頁自動隱藏（沿用 `Service.Workers()` 現有行為）。

### 一般使用者

- 沒有感覺：官方版內建所有收錄的 Worker，在設定頁的新增清單中選用即可。

## 五、影響檔案

- 新增：`apps/steamloom/workerkit/`（go.mod、interface、型別、register、helper、README）
- 新增：`apps/steamloom/writer/cmd/genworkers/`、`workers.cfg`、`workers_gen.go`
- 修改：`apps/steamloom/writer/go.mod`（require＋replace workerkit）、`.gitignore`（`workers.local.cfg`、`workers_local_gen.go`、`go.work`、`go.work.sum`）、`main.go`（go:generate、`customBuild`）
- 修改：`internal/mediaworker/*`（型別改引用 workerkit；registry 改讀 `Modules()`；內建 adapter 改 `init()` 註冊並改新簽章；`types.go`、`adapters.go`、`image_download.go` 部分內容搬出）
- 修改：`app.go`（Worker 相關綁定的型別）、`internal/updater` 或 `app.go`（`customBuild` 擋更新）
- 重新產生：`frontend/wailsjs/go/models.ts`（TS namespace 會從 `mediaworker` 變 `workerkit`）；`frontend/src/lib/backend.ts` 等 7 處型別引用跟著改
- 修改：`.github/workflows/steamloom-writer.yml`（drift 檢查）
- 修改：`internal/mediaworker/README.md` → 精簡成指向 workerkit README；開發指南寫在 workerkit README
- faryne.dev 後端：`?go-get=1` vanity import handler（route＋controller）

## 六、常見失敗與應對

| 情境 | 應對 |
|---|---|
| 兩個 plugin 註冊同一個 ID | `Register` panic，Writer 啟動即失敗；CI 加一個 smoke step 跑 `go test ./internal/mediaworker -run TestModules` 在合併前就抓到 |
| `Module.ID` 與 `Descriptor().ID` 不一致 | `NewDefault` 拒絕並 panic，理由同上 |
| plugin 依賴的 workerkit 版本比 Writer 舊／新 | Go MVS 取較新版；v0 期間破壞性變更要在 workerkit README 的 changelog 寫明，並同步更新所有已收錄 plugin（收錄數少時人工處理即可） |
| plugin 引入的依賴跟 Writer 衝突（例如不同版本的同一個 lib） | MVS 自動升到較高版；真的不相容就退回 PR |
| plugin 在 `init()` 或 `New` 做網路請求／重活 | 開發指南明訂 `init()` 只能 `Register`、`New` 不可 I/O；review 把關 |
| plugin 讀取 Keychain 或其他 Worker 的密鑰 | 同 process 無法技術阻擋，收錄 review 是唯一關卡；開發指南明訂只能用 `GenerateRequest.Secrets` |
| 本機開發忘了刪 `workers.local.cfg` 就 commit | 三個本機產物都在 gitignore；`workers_gen.go` 只由 `workers.cfg` 產生，不會混入本機 module |
| 開發者用本機版打 `wails build` 並分享給別人 | `customBuild` 停用 self-update，關於頁標示自訂版；不另外阻擋 |
| plugin repo 刪除或 tag 被改寫 | `go.sum` 驗證失敗，build 中止；改從 `workers.cfg` 移除或 pin 到新 tag |
| plugin 沒有實作 `Generator` | 沿用現狀：可在設定頁建立與測試，但 Agent 看不到、無法執行；開發指南寫明兩個都要實作 |

## 七、待確認

1. vanity import（保留 `faryne.dev/...` path）vs 直接改用 `github.com/faryne/integration/...` path？規格預設前者。
2. 內建 adapter 要不要也搬出 Writer module（例如 `workerkit/builtin`），讓第三方有完整範例可以 import 參考？規格預設**不搬**，留在 internal，範例另寫一個最小 adapter 放在 workerkit README。
3. `Experimental` 外部 plugin 也可以用嗎？規格預設可以：收錄但只在 dev 版出現，用於「先合進來、還沒實機驗證」的狀態，跟現在 fal／SD WebUI 一樣。

## 另案（本規格不處理）

- 外部 Worker 的多語系 label：前端翻譯 key 只涵蓋內建 adapter，外部 plugin 先直接顯示 `Label` 原文。
- capability 詞彙表與格式驗證（`CompatibleWorkers` 靠 `text_to_` 前綴判斷）。
- `jobFields.<key>` 翻譯 key 跨 adapter 共用的問題。
- 產物驗證補強：symlink（`Lstat`）、MIME sniff、檔案大小上限。

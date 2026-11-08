# joyu.fyi P2：女優為主的新版 layout 規格草稿

> 狀態：草稿，待使用者確認。分支 `feat/joyu-layout-p2`。mockup：`DevelopDocuments/opendata/joyu-layout-mockup/index.html`（`dev-docs-opendata-mockup` 開在 5195 port）。
> 前情：P1 搬家見 `joyu.fyi獨立站_2026-11-08.md`。社群功能（登入、追蹤）**不在這次範圍**。

## 範圍

| 頁面 | 網址 | 改動 |
|---|---|---|
| 首頁 | `/` | **新頁**：統一搜尋、今天有新片的女優、本月生日、女優主題、最新上架影片 |
| 女優搜尋 | `/actress` | 現在首頁的列表**原封不動搬過來**，只換配色 |
| 女優頁 | `/actress/:name` | 基本資料改成頂端整排；作品依年份分組；側欄的發售商、標籤收進篩選列；新增共演女優 |
| 影片頁 | `/video/:no` | 結構不變，**出演女優拉到標題下方**做成女優卡 |
| 影片搜尋、主題、上稿、修改 | — | 只換配色 |
| 全站 | — | joyu 自己的配色（深紫＋粉紅），頁首加搜尋框 |

## 首頁各區塊的資料來源

| 區塊 | 資料 | 後端 |
|---|---|---|
| 統一搜尋 | 符合番號格式 → `/video/{番號}`；其他 → `/actress?name=…` | 不用改 |
| 今天有新片的女優 | 當天配信影片依出演者分組，附女優照片 | **新 API**（見下） |
| 本月生日 | 女優搜尋 `birth_month=當月` | **現成**（`ActressQueryRequest.BirthMonth` 已經有了），只要確認依生日日期排序 |
| 女優主題 | 現有的主題 `index.json` | 不用改 |
| 最新上架影片 | 影片搜尋預設結果取前 6 筆 | 不用改 |

## 後端

### 新 API：`GET /opendata/av/home/new-actresses`

- 用 `VideoIndex.Facets` 一樣的方式，以「配信日＝某一天」為條件，對出演者做 terms agg，取前 30 位，附上當天的部數和其中一部的番號。
- 用女優名字（先去掉括號裡的別名）批次查女優索引，補上照片和 `xcity_id`／`manual_id`，前端才能組出帶參數的女優頁連結。
- **「今天」以日本時間為準**：DMM 的配信日是日本日期。
- **今天還沒有新片時**（例如清晨同步之前），改用最近一個有影片的配信日，回應裡帶出實際日期，前端標題顯示那一天。
- 結果放 Redis 快取 10 分鐘：首頁每個訪客都會打，資料一天只變一次。
- `VideoIndex` 介面要加方法時，遵守「介面不能出現 ES 概念」的規則（之後要換 Manticore）。

### 女優頁統計：`GET /opendata/av/actress/summary`（參數同女優頁：`name` + `xcity_id`／`manual_id`／`dmm_id`）

- **作品數、出道年**：`VideoIndex.DateStats`（部數、最早配信日），現成。
- **共演女優**：同一個出演者條件下對出演者做 terms agg，取前 13 位再扣掉本人，剩 12 位。現在 `Facets` 的出演者只取 10 位，所以不能直接共用，要另外帶 size。
- 發售商、標籤沿用現有的 `/opendata/av/search/video/facets`。

### SNS meta 與舊網址

- `service/sns/joyu_meta.go`：`/av/actress` 現在對應首頁，P2 之後要改成對應 `/actress`。首頁（`/av`）的標題改成站名加一句介紹。
- nginx：拿掉 faryne.dev 的 `location = /av/actress`（原本轉到 joyu 首頁），讓它走通用規則轉到 `/actress`；`/av` 仍然轉首頁。
- `firebase.json`：`/dmm/actress` 改成轉到 `https://joyu.fyi/actress`。

## 前端

- **配色**：新增 `components/joyu/joyuTheme.ts`（MUI theme，深淺色兩套），`JoyuLayout` 改用它，不再沿用主站的 `siteTheme`。頁首、頁尾改成深紫底。
- **頁首搜尋框**：桌機是輸入框，手機是圖示，點了到 `/actress`。番號判斷和首頁搜尋共用同一支 helper。
- **路由**（`routes/joyuRoutes.tsx`）：`/` 換成新首頁，`/actress` 換成女優搜尋列表。原本「`/actress` 轉回首頁」的路由拿掉。
- **連結**：`helpers/avActressName.ts`、`avActressRef.ts` 裡導向女優搜尋的 `joyuPath("?name=")`，改成 `joyuPath("actress?name=")`。
- **麵包屑**（`joyuNavigation.ts`）：「女優」的 href 改成 `/actress`；首頁不顯示麵包屑，跟主站首頁一樣。
- **新首頁**：放在 `pages/joyu/Home.tsx`，各區塊拆成 `components/joyu/home/*`，避免單一檔案過大。
- **女優頁**：`components/av/actress_detail.tsx` 現在 361 行，這次會再長，所以拆成三個元件：頂端資料（`ActressProfileHeader`）、作品（`ActressWorks`）、共演（`ActressCoStars`）。
- **影片頁**：`components/av/video_detail.tsx` 標題下方加女優卡元件。

## 跟 mockup 不同的地方（為了簡化）

1. **作品的年份分組不顯示各年部數**：年份標題直接從目前這一頁的影片配信日分出來。要顯示各年部數，得對每位女優多跑一次「依年統計」的查詢，還要在 `VideoIndex` 加方法，效益不大。
2. **影片頁的女優卡不顯示作品數**：一部影片有幾位女優，就得多查幾次統計。卡片改成顯示照片、名字、罩杯，這些資料女優索引裡就有。

## User stories

- 讀者打開 `joyu.fyi`，看到今天有新片的女優和本月壽星，點頭像進女優頁。
- 讀者在首頁或頁首搜尋框貼上 `ABCD-123`，直接進影片頁；輸入名字則進女優搜尋，帶好關鍵字。
- 讀者在女優頁一眼看到年齡、身高、三圍、出道年、作品數，往下依年份看作品，再從共演女優跳到別人。
- 讀者在影片頁點出演女優的卡片，進女優頁。
- 舊書籤 `faryne.dev/av/actress?name=…` 會轉到 `joyu.fyi/actress?name=…`，搜尋條件還在。

## 常見 fail 與對應

| 狀況 | 對應 |
|---|---|
| 今天還沒有新片（同步之前） | API 改用最近一個有影片的配信日，標題顯示實際日期 |
| 出演者名字對不到女優資料（新人還沒建檔、名字寫法不同） | 卡片照常顯示名字，照片用預設佔位圖，點了用名字進女優搜尋 |
| 同名女優 | 新片列表用名字對到多位時不帶參數，進女優頁後由現有的同名提示處理 |
| 本月生日的人很多 | 首頁只顯示前 16 位（今天生日的排最前面），「看全部」帶 `birth_month` 進女優搜尋 |
| 番號格式誤判（名字剛好長得像番號） | 影片頁找不到時顯示 404；404 頁加一顆「改用關鍵字搜尋」，帶原字串到女優搜尋 |
| 首頁 API 掛掉 | 該區塊顯示 Snack 錯誤提示，其他區塊照常（各區塊各自打 API，不互相卡住） |
| 共演女優為空（全是單體作品） | 共演區塊整個不顯示 |

## 待確認

1. 上面兩項簡化（不顯示各年部數、女優卡不顯示作品數）可以嗎？
2. 首頁「本月生日」只放前 16 位可以嗎？
3. 番號格式我打算用 `^[A-Za-z]{2,6}-?\d{2,5}$`，像 `h_237nact00198` 這種 DMM 內部番號不會被判成番號，會進女優搜尋。可以接受嗎？

## 決議（2026-11-08）

待確認的 3 項照建議：不顯示各年部數、影片頁女優卡不顯示作品數、番號格式用 `^[A-Za-z]{2,6}-?\d{2,5}$`。

## 實作紀錄（2026-11-08）

跟上面規格不同、或規格沒寫到的地方：

- **「本月生日」改成「近期生日」（今天到月底）**：一個月有七、八百位壽星，依日期排的話前 16 位全是 1 號，跟「今天」無關。女優搜尋在**不帶年份**時支援 `birth_month`（篩當月、依日期排），再帶 `birth_day` 時只取那天（含）以後。「看全部」帶 `birth_month` 進女優搜尋，搜尋頁會顯示「生日：N 月」條件。
- **新片女優卡不顯示「最新一部的番號」**：每位女優要多查一部影片，或在 `VideoIndex` 用 ES 專屬的 top_hits，所以只顯示當天的部數。
- **新 API 實作**：`VideoIndex` 加了 `TopActresses(ctx, q, size)`（ES 實作是 terms agg），新片女優和共演女優共用。新片日期是「明天（日本時間）以前最新的配信日」，所以今天還沒有新片時，會自然退回最近一天。
- **女優頁篩選列是真的篩選**：發售商、標籤 chip 會在網址加上 `?maker=`／`?tag=`，查詢這位女優的作品，再點一次取消。選項來自 facets（這位的全部作品），不再像舊版只從目前這一頁統計，點了也不會跳去影片搜尋。
- **首頁主題只放三組**：特輯、身材、近期活躍。星座、出生年代、出身地、類型這幾組放在主題總覽頁。
- **影片頁女優卡**：有 DMM 女優 ID 先用 ID 找人；ID 在對照表裡對不到時，女優搜尋會回空結果，這時退回用名字找。合輯最多只放 8 張卡。
- **女優頁麵包屑**補上名字；`ActressLinksCard` 只有女優頁在用，改成頂端的行內版本 `ActressLinks`。
- **joyu 的色彩模式偏好**存在自己的 localStorage key（`joyu-color-mode`），跟主站分開。
- **女優頁年份篩選與 sticky 年份標題**（使用者提議加強年份分組，不採用 Accordion）：篩選列多一排「年份」chip，從出道年到最新一年（取自 summary），點了帶 `?year=` 只看那一年，再點一次取消；不另外查各年有沒有作品，中間沒作品的年份點了會顯示沒有作品。年份標題捲動時固定在頁首下方。
  - 順手修正：影片搜尋只給 `year` 時，上限原本是 `lt 12/31`，12/31 當天配信的影片會被排除，改成 `lt 隔年 1/1`（`repository/av/video_index_es_query.go`，附測試）。
- **影片頁出演女優卡全部列出**：不再只放前 8 位。新增 `GET /opendata/av/actress/by-names?name=…`，用名字批次取女優資料（最多 100 個名字），整頁只打一次 API。
  - 取捨：同名女優有多位時不附照片（分不出是誰），連結仍用 DMM 女優 ID 分得開；之前那版「ID 對不到時退回用名字找」的做法，因為一張卡要打一到兩次 API，所以拿掉。

## 快取、主題資料代理、reCAPTCHA（2026-11-08）

### 快取
- **公開 GET API 加 `Cache-Control: public, max-age=60, s-maxage=600`**（`middleware/httpcache`），套用在 `/opendata/av/search/video`、`search/video/facets`、`search/actress`、`home/new-actresses`、`actress/summary`、`actress/by-names`。只有 200 回應會加，錯誤和 404 不快取。
  - 這個專案連成功回應也是 handler 以 error（`output.CommonOutputInterface`）回傳、再由 ErrorHandler 寫出去，所以中介層看回傳值裡的 HTTP code 判斷是否成功，不能只看 `err == nil`。
  - **Cloudflare 要另外設 Cache Rule**：`joyu.fyi/api/opendata/av/*` 設成可快取並遵守來源站的 Cache-Control，Cloudflare 預設不快取 JSON。
  - 影片頁「同步資料」之後的重查（`onSynced`、`onOrphaned`）會帶 `_fresh=時間戳` 繞過瀏覽器和 Cloudflare 快取，避免拿到舊資料或快取住的「查無資料」。
- **joyu 的 React Query 預設 `staleTime` 改成 5 分鐘**（`main.tsx`，只限 joyu 網域）。
- **`xcityActressIndexReady()` 放記憶體快取 1 小時**，女優搜尋每次少打一次 ES；查詢失敗不快取。

### 主題資料走同網域代理
- joyu 的 nginx 新增 `location ^~ /cdn/opendata/av/actress-topics/`，代理到 `cdn.faryne.dev`，而且只開放主題這個目錄。前端在 joyu 正式站改打 `/cdn/...`，網路請求裡就不會出現 faryne.dev；本機開發沒有這層代理，維持直接打 CDN。

### reCAPTCHA Enterprise（Google Fraud Defense）
- **保護範圍**：joyu 的女優上稿（`ACTRESS_SUBMIT`）、影片修改（`VIDEO_SUBMIT`）。MCP 上稿沒有瀏覽器，不經過驗證，維持只靠 IP 限流。
- **前端**（`src/lib/recaptcha.ts`）：使用上稿 hook 的表單頁一打開就載入 script，送出時取 token，放在 `X-Recaptcha-Token` header。site key 讀 `VITE_JOYU_RECAPTCHA_SITE_KEY`，只在 joyu 網域啟用，所以只有表單頁會出現 reCAPTCHA 徽章。
- **後端**（`service/recaptcha`）：用 key 的 legacy secret（`JOYU_RECAPTCHA_SECRET`）呼叫 `siteverify`，確認 token 有效、action 相符，而且分數 ≥ `JOYU_RECAPTCHA_MIN_SCORE`（預設 0.5），沒過就回 403（`403401`）。
  - 原本規劃走 assessments API（要 Google Cloud 專案 ID 加 API key），使用者提供的是 legacy secret，所以改走 siteverify，不需要專案 ID 和 API key。
  - secret 沒設就**不驗證、直接放行**，本機和尚未設定的環境不會卡住。
  - Google 那邊本身出錯（逾時、非 200、回應解析失敗）時也放行並記 log：上稿另外有 IP 限流，不能因為 Google 暫時有問題就讓所有人都送不出去。

# joyu.fyi RSS（2026-11-19）

## 範圍
| 網址 | 內容 | 排序 |
|---|---|---|
| `/feed/new[/<女優名字>]` | 最新配信的作品 | 配信日新到舊 |
| `/feed/upcoming[/<女優名字>]?range=1day\|1week\|1month` | 明天起 1／7／30 天內的預約作品（沒帶 range 是 1week，其他值回 400） | DMM 收藏數 |

- 路徑最後加女優名字時只看這位，參數同女優頁（`?xcity_id=…`／`manual_id`／`dmm_id`，同名女優才不會混在一起），例：`/feed/upcoming/水川潤?range=1month&xcity_id=4043`。
- 2026-11-19 使用者調整：原本女優是另一條 `/feed/actress/<名字>`（只有新片），改成掛在 new／upcoming 底下，女優也能訂即將發售。
- 每個 feed 最多 100 筆。
- upcoming 依人氣排序：光明天就常有 200 部以上，照配信日排的話三種範圍會拿到同一批。改成依人氣後，2026-11-19 實測 30 天的 feed 涵蓋 11/20～12/10，跟明天那條只重疊 38 筆。
- 不做 XSLT：Chrome 預定 2026-11 移除，Firefox、Safari 也同意拿掉。瀏覽器版就是現有的頁面（首頁新片、即將發售、女優頁）。
- 不在 feed 裡放廣告：RSS 閱讀器會把 iframe、script 濾掉。收益靠點回影片頁的版位。

## 項目內容
- **title**：`番號 片名`。番號規則同影片頁網址：`maker_no` 優先，沒有就用大寫的 `no`。
- **link**：影片頁加 utm，`utm_source=rss&utm_medium=feed&utm_campaign=new|upcoming`，女優的是 `actress-new|actress-upcoming`。頻道連結也帶。
- **guid**：不帶 utm 的影片頁網址。之後改 utm 也不會讓閱讀器把舊項目當成新的。
- **description**：封面一段，出演、配信日、發售商合成一段、用 `<br>` 分行（每行各一個 `<p>` 的話在 Feedly 會隔得很開），只放摘要。
- **category**：標籤。
- **Feedly 的封面**：Feedly 會把第一張圖拿去當代表圖，從內文移掉。只顯示標題的版面看不到封面，切成 Cards／Magazine 就有縮圖（2026-11-19 使用者實測）。這不是 bug，不用改圖片來源。
- **enclosure**：封面。
- **pubDate**：`vod_date`，沒有就用 `publish_date`，**台灣時間**當天 00:00。2026-11-19 從日本時間改過來，原因是 Feedly 會把日本時間 00:00 顯示成前一天 23:00，跟內文的配信日對不上。補抓進來的舊片排序會比較後面，但 guid 是新的，閱讀器一樣會列出來。

## 架構
- `service/rss/`：RSS 2.0 共用結構（neko.maid.tw 搜尋 RSS 也改用這套）。
- `service/av/joyu_rss.go`：查詢沿用影片搜尋的 `videoIndexQuery`。`VideoIndexQuery.Size` 一次查 100 筆，這個參數不開放給 API。
- `controller/opendata/av_joyu_rss.go`、`route/opendata.go`：`/opendata/av/feed/new/:name?`、`/opendata/av/feed/upcoming/:name?`。瀏覽器和 Cloudflare 都快取 30 分鐘（`httpcache.Public`）。
- `httpd_conf/nginx`：`joyu.fyi/feed/*` 轉給 `http://faryne_api/opendata/av$request_uri`。
  - proxy_pass 帶變數時網址會原樣送出，女優名字的 UTF-8 不會被重複編碼。
  - 用 rewrite 改網址的話，nginx 會把 `%` 再編碼一次。
- **前端**：`data/joyuFeeds.ts` 的 `joyuFeeds()` 產生一組 feed（新片＋即將發售三種範圍），全站與女優共用，`RssSubscribeMenu` 點選後會複製網址。放在三個地方：首頁「新片」區塊、即將發售頁標題、女優頁（只在 joyu.fyi 上）。
- **index.html**：build 時由 `vite-plugins/siteBranding.ts` 寫入 `<link rel="alternate">`，閱讀器不用執行 JS 就找得到。

## 部署順序
1. 後端。
2. nginx：`httpd_conf/nginx` 的 joyu.fyi `location ^~ /feed/`，改完 `nginx -t` 後 reload。
3. 前端（joyu build）。
4. Cloudflare：設定 WAF 和 Cache Rule（見下節）。

## Cloudflare（joyu.fyi，橘雲）
1. **Security → Bots**
   - 免費方案的 Bot Fight Mode **不能**用規則略過。
   - Feedly、Inoreader 這類 verified bot 通常會被放行；自架閱讀器（FreshRSS、Miniflux）和 TG 的 RSS bot 可能被 challenge。
   - 有人反映抓不到時，只能關掉 Bot Fight Mode。
   - 如果是 Super Bot Fight Mode（Pro 以上），下面的 Skip 規則可以略過。
2. **Security → WAF → Custom rules**：新增一條，排第一順位。
   - Expression：`(http.host eq "joyu.fyi" and starts_with(http.request.uri.path, "/feed/"))`
   - Action：Skip。勾選：
     - All remaining custom rules
     - Rate limiting rules
     - Super Bot Fight Mode（有的話）
     - Browser Integrity Check
     - Security Level
3. **Caching → Cache Rules**：條件同上，設 Eligible for cache，Edge TTL 選「Use cache-control header」（後端回 `public, max-age=1800, s-maxage=1800`）。
   - Cloudflare 預設不快取沒有副檔名的路徑，不加這條規則的話，閱讀器每次輪詢都會打到後端。
   - Browser TTL 也要選「Respect origin」。部署後實測 prod 回的是 `max-age=14400`，代表 zone 的 Browser Cache TTL（4 小時）把後端的 1800 蓋掉了，閱讀器可能因此隔 4 小時才更新。

## 驗證（2026-11-19，本機讀 prod ES）
- 三條 feed 都回 100 筆，`Content-Type: application/rss+xml`。
- `range=2week` 回 400。
- 女優 feed（水川潤 xcity_id=4043）：新片 100 筆，即將發售（30 天）2 筆，跟女優頁一致。頻道連結帶回 `xcity_id`。
- `VITE_SITE=joyu` build 出來的 index.html 有 4 條 alternate。
- 預覽視窗裡複製網址會失敗（預覽視窗不給剪貼簿權限），所以只驗到失敗時的提示；成功路徑跟 vtuber 行事曆的複製用同一個 API。

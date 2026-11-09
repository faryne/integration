# joyu.fyi 社群功能第二期（2026-11-09）

> 狀態：已確認（2026-11-09）。實作順序：片單 → 討論版 → 即將發售。
> Mockup：`DevelopDocuments/opendata/joyu-community2-mockup/index.html`
> 前一期：`joyu.fyi社群功能第一期_2026-11-08.md`（登入、追蹤、我的追蹤頁）

## 範圍

| 項目 | 這期 | 備註 |
|---|---|---|
| 討論版（自建） | ✅ | 不用 Disqus；支援 Markdown、擋 HTML／圖片／script；不擋匿名；每則記錄 IP |
| 想看／看過＋評分（片單） | ✅ | |
| 即將發售 | ✅ | 做法見第三節，有可行性驗證 |
| 隱藏標籤、ICS 訂閱 | ❌ | 使用者決定先不做 |
| 貢獻者署名 | ❌ | 另外排 |

建議實作順序：片單 → 討論版 → 即將發售。各自開分支，做完一個 merge 一個。片單最單純，而且即將發售會用到「想看」。

---

## 一、討論版

### 決定事項（已確認）

1. **掛在哪裡**
   - 影片頁：分頁列多一個「討論（N）」，排在「圖片預覽」後面。
   - 女優頁：放在頁面最下方存在感太低，改成作品區的分頁列多一個「討論（N）」；頂端資料區另外放一個「💬 N 則討論」的小 chip，點了切到討論分頁並捲過去。
   - 同一位女優的不同名義（別名頁）共用同一個討論版，key 是 `domain:aid`。
2. **結構：留言＋一層回覆**
   - 頂層留言預設新的在前，每頁 20 則。
   - 回覆掛在頂層留言底下，依時間先舊後新排列，只有一層。
   - 對回覆再回覆時，一樣掛在同一則頂層留言下，開頭帶「@暱稱」。
   - 每則頂層留言預設顯示最新 3 則回覆，其餘收在「顯示全部 N 則回覆」。
3. **誰能留言**
   - 匿名和 Google 帳號都可以。
   - 沒登入的人按「送出」時，跟追蹤一樣自動建立匿名帳號。
4. **顯示名稱**
   - **不用 Google 帳號的名字**，以免洩漏真名。
   - 匿名帳號固定顯示「訪客-a1b2」，後四碼從 uid 雜湊而來，同一個人固定不變。
   - 用 Google 登入的人可以在新的**個人資料頁**（`/me/profile`）改暱稱，限 2～20 字，不同人可以重複。
   - 匿名帳號不能改暱稱，避免換個名字繼續洗版或冒充別人。
   - 「刪除帳號」從我的追蹤頁搬到個人資料頁。
   - 暱稱要存在站內，所以新增 `joyu_users` 資料表；只存暱稱，不存 email 或 Google 名稱。
   - 名字旁標「匿名」或「Google」小標，讓其他人知道帳號類型。
5. **Markdown**
   - 支援：段落、換行、粗體、斜體、刪除線、清單、引用、行內程式碼與程式碼區塊。
   - **不產生任何連結**：
     - 網址不會自動變成可點的連結，避免有人散播惡意連結、被誤點。
     - `[文字](網址)` 寫法顯示成純文字「文字（網址）」，網址藏不住。
   - 不支援：
     - **標題**：顯示成一般文字。
     - **表格**：顯示成一般文字。
     - **圖片**：只顯示替代文字，不載入圖片。
     - **HTML**：一律當成純文字顯示，不會被瀏覽器執行。
   - 前端用既有的 `react-markdown`，不掛 `rehype-raw`；`allowedElements` 白名單不含 `a`、`img`、標題、表格，並關掉 GFM 的網址自動連結。
   - 後端也再擋一次：內文出現 HTML 標籤（`<tag …>`）或圖片語法（`![…](…)`）就回 400「不支援 HTML 與圖片」。
   - 長度上限 2,000 字。
6. **不能編輯、不能刪除**
   - 留言者不能編輯，也不能刪除自己的留言，只有後台管理員能刪。
   - 管理員刪除後留下「此留言已被管理員刪除」的佔位，底下的回覆照常顯示。
   - 刪帳號時留言保留，名字改顯示「已刪除的帳號」。
7. **防灌水**
   - 匿名帳號每次送出都要過 reCAPTCHA，沿用上稿用的 `service/recaptcha`，action 用 `joyu_comment`。Google 帳號不用。
   - 頻率限制（Redis）：
     - 同一個 uid：20 秒 1 則。
     - 同一個 IP：10 分鐘 10 則、一天 50 則。
   - 被封鎖的 uid 或 IP 送出時回 403「無法留言」，不說明原因。
8. **檢舉與管理**
   - 每則留言有「檢舉」，原因選垃圾訊息、騷擾、個資、其他。同一人對同一則只算一次。
   - 後台（`faryne.dev/backend_admin`）新增「joyu 留言」頁：
     - 分頁籤：被檢舉的、最新的、封鎖名單。
     - 可以刪除留言（標記為管理員刪除）。
     - 可以封鎖 uid 或 IP，期限 1 天、7 天、永久擇一。
     - 列表顯示 IP、uid、帳號類型、檢舉次數。
9. **IP**
   - 每則留言都記錄 IP，經由既有的 `controller/helper/ClientIP`，也就是 nginx 帶的 X-Real-IP。
   - **不清空**，刪帳號時也保留。
10. **通知**：這期不做，留接口。

### Schema（MySQL 5.7）

```sql
-- joyu 帳號的站內資料：只有暱稱與封鎖狀態，不存 email、Google 名稱
CREATE TABLE joyu_users (
  firebase_uid VARCHAR(128) NOT NULL PRIMARY KEY,
  nickname     VARCHAR(32)  NOT NULL DEFAULT '',
  is_deleted   TINYINT(1)   NOT NULL DEFAULT 0,  -- 刪帳號：留言保留、名字改顯示「已刪除的帳號」
  deleted_at   DATETIME NULL,
  created_at   DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE joyu_comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  target_type  VARCHAR(16)  NOT NULL,          -- actress / video
  target_key   VARCHAR(64)  NOT NULL,          -- actress: domain:aid；video: DMM 內部番號（小寫）
  firebase_uid VARCHAR(128) NOT NULL,
  is_anonymous TINYINT(1)   NOT NULL,          -- 留言當下的帳號類型
  body         TEXT         NOT NULL,          -- 原始 Markdown
  parent_id    BIGINT UNSIGNED NOT NULL DEFAULT 0, -- 0 = 頂層留言；回覆指向頂層留言（只有一層）
  reply_to_uid VARCHAR(128) NOT NULL DEFAULT '',   -- 回覆的是誰（顯示 @暱稱用）
  ip           VARCHAR(45)  NOT NULL DEFAULT '',
  report_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_deleted   TINYINT(1)   NOT NULL DEFAULT 0,
  deleted_at   DATETIME NULL,
  deleted_by   BIGINT UNSIGNED NOT NULL DEFAULT 0, -- 刪除的後台管理員（faryne.dev users.id）
  created_at   DATETIME NOT NULL,
  KEY idx_target (target_type, target_key, parent_id, created_at),
  KEY idx_uid (firebase_uid, created_at),
  KEY idx_reported (report_count, created_at)
);
CREATE TABLE joyu_comment_reports (
  comment_id BIGINT UNSIGNED NOT NULL, firebase_uid VARCHAR(128) NOT NULL,
  reason VARCHAR(16) NOT NULL, ip VARCHAR(45) NOT NULL DEFAULT '', created_at DATETIME NOT NULL,
  PRIMARY KEY (comment_id, firebase_uid)
);
CREATE TABLE joyu_bans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ban_type VARCHAR(8) NOT NULL,     -- uid / ip
  value    VARCHAR(128) NOT NULL,
  reason   VARCHAR(255) NOT NULL DEFAULT '',
  expires_at DATETIME NULL,         -- NULL = 永久
  created_by BIGINT UNSIGNED NOT NULL, -- 後台管理員（faryne.dev users.id）
  is_deleted TINYINT(1) NOT NULL DEFAULT 0, deleted_at DATETIME NULL, created_at DATETIME NOT NULL,
  KEY idx_value (ban_type, value)
);
```

### API

```
GET    /opendata/av/comments?target=video:abcd00123&page=   公開（no-store，讓剛送出的留言馬上看得到）：頂層 20 則＋各自最新 3 則回覆
GET    /opendata/av/comments/:id/replies                     公開：某則頂層留言的全部回覆
POST   /joyu/me/comments        {target, body, reply_to?, recaptcha?}   需登入（匿名也可）；reply_to 是頂層或回覆的 id
POST   /joyu/me/comments/:id/report {reason}
GET    /joyu/me/profile
PUT    /joyu/me/profile         {nickname}（只限 Google 帳號）
GET    /admin/joyu/comments?tab=reported|latest   後台（主站登入且 is_admin）
DELETE /admin/joyu/comments/:id
POST   /admin/joyu/bans         {ban_type, value, days?, reason}
```

---

## 二、想看／看過＋評分（片單）

### 決定事項（待確認）

1. **兩種狀態互斥**：想看、看過，一部片只能是其中一種。按已選的那顆會取消。
2. **評分**：只有「看過」才能評，1～5 顆星，可以不評。點同一顆星會取消評分。直接按星星會自動改成「看過」。
3. **影片頁**
   - 標題下方、資料列上面放兩顆按鈕「想看」「看過」，選了「看過」後右邊出現星星。
   - 旁邊顯示全站統計：「想看 N・看過 N・★4.2（12 人）」。**評分人數少於 3 人時不顯示平均分數**，避免一個人就決定分數。
4. **影片卡片**：登入後，想看、看過的片在封面角落顯示小標。全站的影片卡片都會出現，包括搜尋、女優頁、首頁。
5. **我的片單頁**（`/me/videos`）
   - 分頁籤：想看、看過。
   - 看過可以依評分篩選；排序可選加入時間或發售日。
   - 帳號選單多一項「我的片單」。
6. **上限**：每人 5,000 部，避免卡片小標要讀的清單無限長。
7. **個人隱私**：片單只有自己看得到；公開的只有統計數字。
8. **帳號處理**：匿名升級合併時一起搬，遇到重複的以 Google 帳號原有的為準；刪帳號時一起刪。

### Schema

```sql
CREATE TABLE joyu_video_marks (
  firebase_uid VARCHAR(128) NOT NULL,
  video_no     VARCHAR(32)  NOT NULL,          -- DMM 內部番號（小寫）
  status       VARCHAR(8)   NOT NULL,          -- want / watched
  rating       TINYINT UNSIGNED NOT NULL DEFAULT 0, -- 0 = 未評分
  created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  PRIMARY KEY (firebase_uid, video_no),
  KEY idx_video (video_no, status)
);
```

### API

```
GET    /opendata/av/video/:no/marks-summary          公開：{want, watched, rating_avg, rating_count}，CDN 快取 1 分鐘
GET    /joyu/me/marks                                輕量清單（卡片小標用）：[{no, status, rating}]
GET    /joyu/me/marks/videos?status=&rating=&sort=&page=   片單頁（帶影片資料）
PUT    /joyu/me/marks/:no   {status, rating}
DELETE /joyu/me/marks/:no
```

---

## 三、即將發售（我的提案）

### 可行性（2026-11-09 已驗證）

- 每日同步呼叫 DMM 的搜尋 API 時帶了 `excludeUndelivered: true`，所以索引裡**完全沒有**未來配信日的影片。查明天以後都是 0 部。
- 同一支 API 改成 `excludeUndelivered: false` 再查未來日期，就拿得到 `releaseStatus = PRE_ORDER` 的預約作品：11/13 有 138 部、11/20 有 103 部、12/5 有 2 部。
- 清單只有標題、封面、預約狀態與 `bookmarkCount`（DMM 上的收藏數），**沒有出演、發售商、標籤**。要做女優、追蹤相關的功能，得跟每日同步一樣逐部抓明細。

### 做法

1. **資料放在獨立的 ES 索引**（新的環境變數 `DMM_UPCOMING_INDEX`），mapping 跟影片索引一樣。
   - 不放進原本的影片索引：首頁最新影片、搜尋、女優統計都預設「配信日 ≤ 今天」，混進去要每個地方加條件，很容易漏。
   - 用同樣的 mapping，`VideoIndex` 的查詢組裝（出演、發售商、標籤…）可以直接沿用，只是換索引名稱。
2. **排程**（每天一次，**只在正式環境執行**，因為本機跟正式機共用 ES）
   - 依序抓明天起 30 天的預約清單（每頁 20 部、翻完為止）。
   - 新出現的作品抓明細。已經抓過的，7 天內不重抓；剩 3 天內就要配信的再重抓一次，因為預約作品常改標題、改日期。
   - 寫入時多存 `release_status`；DMM 的收藏數（`bookmarkCount`）只拿來排序，**不在畫面上顯示**。
   - 刪除這次沒抓到的（預約取消或改期到 30 天外），以及配信日已經到了的。配信當天，每日同步會把正式資料寫進原本的索引。
   - 流量估算：第一次大約 2,000～3,000 部明細，之後每天新增約 100～150 部，跟現在的每日同步同一個量級，沿用相同的並發數（2）與延遲。
3. **畫面**
   - **即將發售頁**（`/upcoming`，頁首導覽新增「即將發售」）
     - 依配信日分組，日期由近到遠。
     - 上方有「全部／我追蹤的」切換，以及近 7 天、30 天的範圍。
     - 卡片右上角顯示配信日（例如 11/20）。
     - 同一天內依 DMM 收藏數排序，但不顯示數字。
   - **首頁**：多一個「下週發售」區塊，取未來 7 天 DMM 收藏數最高的 12 部，一樣不顯示數字。
   - **女優頁**：有預約作品時，作品區上方多一列「即將發售」。
   - **我的追蹤頁**：預約作品**跟原本的新片放在同一列**，卡片上標「即將發售・11/20」；不另外開一列，避免太佔空間。片數多時改成可左右滑動的 carousel。用同一組條件去查預約索引。**這是最有用的部分**，例如追蹤的女優下個月出新片，會提前看到。有預約作品但最近沒新片的追蹤，也算「有東西」，不會被歸到下方的安靜清單。
   - **影片頁**：網址一樣是 `/video/番號`。原本的索引查不到時，改查預約索引，標題旁顯示「預約中・11/20 配信」，沒有相關作品分頁。預約作品也可以按「想看」。
   - **MCP**：`av_video_search` 加一個 `upcoming: true` 參數改查預約索引。這項可以之後再做。
4. **新片數量**：區塊標題的「N 部新片」只算已經配信的；預約作品另外寫「＋M 部即將發售」。

---

## 影響範圍（摘要）

| 層 | 新增／修改 |
|---|---|
| migration | `joyu_users`、`joyu_comments`、`joyu_comment_reports`、`joyu_bans`、`joyu_video_marks` |
| model／repository／service | `joyu_comment*`、`joyu_mark*`、`joyu_profile`、`upcoming*`（排程、索引）；`VideoIndex` 加可指定索引名稱的建構函式 |
| controller／route | `controller/joyu/`（留言、片單、暱稱）、`controller/opendata/`（公開留言、片單統計、即將發售）、後台 `admin/joyu` |
| main.go | 即將發售排程（`IsProduction` 才跑） |
| 前端 joyu | 討論元件（列表、送出、Markdown 顯示）、片單按鈕與星星、卡片小標、`/me/videos`、`/upcoming`、首頁區塊、女優頁與我的追蹤頁的即將發售列、帳號暱稱 |
| 前端後台 | joyu 留言管理頁 |
| MCP | （之後）`upcoming` 參數 |

## 常見失敗與處理

| 情況 | 處理 |
|---|---|
| 匿名帳號大量灌留言 | reCAPTCHA＋uid／IP 頻率限制＋後台封鎖 IP |
| 有人貼 `<script>` 或 `![](追蹤像素)` | 後端直接拒絕；前端就算收到也只當純文字、不載入圖片 |
| 有人貼釣魚網址 | 不產生任何連結，只顯示純文字；被檢舉後由後台刪除 |
| 留言者刪帳號 | 留言保留，名字改顯示「已刪除的帳號」；IP 保留 |
| 預約作品改期或取消 | 每天重抓 30 天內的清單，這次沒抓到的就刪除；剩 3 天配信的重抓明細 |
| 配信當天兩個索引都有同一部 | 影片頁先查原本的索引；排程同時刪掉配信日已到的預約資料 |
| DMM 改 schema | 沿用 `send()` 遇到 422 就回錯誤的機制，排程失敗只記 log，不寫入半套資料 |
| 本機誤跑排程寫進正式機 ES | 排程開頭檢查 `IsProduction`，本機手動測試改寫到測試索引 |

## 使用者的決定（2026-11-09）

1. 顯示名稱：登入後可以在個人資料頁修改（新增 `joyu_users` 資料表）。我補充的做法是只開放 Google 帳號修改，匿名帳號固定顯示「訪客-xxxx」。
2. 匿名帳號每次留言都要過 reCAPTCHA。
3. 留言 IP 不清空。
4. 討論版不開放編輯、也不開放刪除；回覆以一層為限。
5. 即將發售以 30 天為範圍；抓取照提案進行。在我的追蹤頁跟新片放同一列並加標示，太多時用 carousel；DMM 的收藏數不顯示。
6. 女優頁的討論改成作品區的分頁，並在頂端放討論數 chip。
7. 留言裡的網址不自動變成連結。

## 實作紀錄

### 片單（2026-11-09，分支 `feat/joyu-video-marks`）
- 後端：
  - migration `20261109100000-create_joyu_video_marks.sql`。
  - `repository/av/joyu_video_mark.go`：讀取一律走 primary。
  - `service/av/joyu_video_mark.go`：番號正規化、上限 5000、「想看」一律把評分歸零、評分少於 3 人時不給平均。
  - `VideoIndex.FindByNos`：依番號取影片，大小寫都認。片單頁依加入時間排序時，由 DB 分頁再補影片資料；依配信日排序時，把符合篩選的番號全交給 ES 排序分頁。
  - `MergeJoyuFollows` 改名為 `MergeJoyuAccountData`，合併時一起搬片單；刪帳號時一起刪片單。
  - 公開統計 `/opendata/av/video/:no/marks-summary` 帶 CDN 快取。剛按過的那部，前端之後查統計時帶 `_fresh` 繞過快取。
- 前端：
  - `apis/av/joyu_marks.ts`：query key 都以 `joyu/marks` 開頭，登出、刪帳號時一次清掉。
  - `components/joyu/marks/`：`VideoMarkButtons`（影片頁）、`VideoMarkBadge`（`VideoResultCard`、`VideoCoverCard` 的封面左上角）、`useVideoMark`。
  - `pages/joyu/MyVideos.tsx`（`/me/videos`）；帳號選單新增「我的片單」；麵包屑的「我的追蹤」不再涵蓋整個 `/me`。
- 本機驗證（匿名帳號）：
  - 想看 → 點 4 星（自動變看過）→ 再按看過（取消）→ 按看過 → 點 5 星 → 用真的滑鼠再點 5 星（取消評分、維持看過）。每一步的按鈕狀態和統計數字都正確。
  - 片單頁的想看／看過、★5、未評分、依配信日排序都正確；「想看」帶評分送出時會被歸零。
  - 番號格式錯誤、狀態錯誤回 400。
  - 暫時塞入兩筆評分，3 人評分時平均顯示 4.0，驗完已刪除。
  - 搜尋頁卡片的小標（看過★5、想看、看過）正常。
  - 刪帳號後片單清空。

### 順手修的 bug：剛簽發的 Firebase token 被後端拒絕
見 `joyu.fyi社群功能第一期_2026-11-08.md` 的「已知 Bug 記錄」。

### 討論版（2026-11-09，分支 `feat/joyu-comments`）
- 後端：
  - migration `20261109120000-create_joyu_comments.sql`，四張表：`joyu_users`、`joyu_comments`、`joyu_comment_reports`、`joyu_bans`。
  - repository：`joyu_comment.go`、`joyu_user.go`、`joyu_ban.go`，讀取一律走 primary。
  - service：
    - `joyu_comment_body.go`：內容檢查、留言位置解析、顯示名稱。
    - `joyu_comment.go`：列表、回覆、送出、檢舉、暱稱。
    - `joyu_comment_admin.go`：後台管理。
  - HTML 判斷是 `</?[a-z!][^>]*>`，`<` 後面要緊接字母、`/` 或 `!`，所以「a < b 而且 c > d」這種數學式不會誤判。
  - 送出順序：內容檢查 → 封鎖檢查 → 匿名帳號驗 reCAPTCHA（action `JOYU_COMMENT`）→ uid／IP 頻率限制。頻率限制在 Redis 出錯時放行並記 log。
  - 回覆別人的回覆時，掛在同一則頂層留言下，並記下 `reply_to_uid`；前端顯示時在內文前加「@名字」。
  - 匿名升級時遇到既有帳號（`MergeJoyuAccountData`），留言、被回覆對象、檢舉都改掛到正式帳號。刪帳號時 `joyu_users` 標記刪除、暱稱清空，留言保留。
  - 路由：
    - 公開：`/opendata/av/comments`、`/opendata/av/comments/:id/replies`（no-store）。
    - 個人：`/joyu/me/comments`、`/joyu/me/comments/:id/report`、`/joyu/me/profile`。
    - 後台：`/admin/joyu/*`（主站 session，service 裡檢查管理員）。
- 前端：
  - `components/joyu/comments/`：`CommentSection`、`CommentThread`、`CommentItem`、`CommentComposer`、`CommentMarkdown`。
    - `CommentMarkdown` 不掛 rehype-raw 並加 `skipHtml`。`a` 一律顯示成純文字（`[文字](網址)` 變成「文字（網址）」），`img` 只留替代文字，標題變一般段落，表格攤平。
    - 段落套 `white-space: pre-line`，按 Enter 就是換行。
  - 影片頁：`VideoDetailTabs` 在圖片預覽後面加「討論（N）」。
  - 女優頁：`ActressDetail` 加「作品／討論（N）」分頁（`?view=comments`），頂端資料區的討論數 chip 點了會切過去並捲到分頁列。
  - `pages/joyu/MyProfile.tsx`（`/me/profile`）：暱稱只限 Google 帳號修改；「刪除帳號」從我的追蹤頁搬到這裡。
  - 後台 `pages/backendAdmin/av/joyu_comments.tsx`（`/backend_admin/av/comments`）：被檢舉的、最新的、封鎖名單三個分頁籤。
- 本機驗證：
  - 沒帶 reCAPTCHA token 的匿名留言回 400；帶真的 token 就能留言。
  - 20 秒內再留回 429；HTML 回 400；跨影片回覆回 404。
  - 回覆別人的回覆時帶 @；同一人重複檢舉只算一次；匿名帳號改暱稱回 403。
  - 從畫面測過：Markdown 顯示（沒有 `<a>`、連結藏不住）、回覆、檢舉、女優頁的 chip 與分頁、個人資料頁、刪帳號後留言改顯示「已刪除的帳號」。
  - 後台：非管理員回 403；暫時把本機測試帳號設成管理員後，列表、刪除（前台變成佔位）、封鎖（被封鎖的帳號留言回 403）、解除封鎖都正常，測完已改回。
  - 測試資料都已刪除。

### 已知 Bug 記錄
- **React Compiler 在 render 時讀取 onClick 裡的 `x!.id`**（2026-11-09，開發中發現）
  - 現象：後台留言管理頁一打開就整頁白掉，console 顯示 `Cannot read properties of undefined (reading 'id')`。
  - Root cause：React Compiler 把 onClick 閉包裡的 `confirmDelete!.id` 當成記憶化的依賴，在 render 時就去讀；`confirmDelete` 一開始是 `undefined`。非空斷言只騙得過 TypeScript，騙不過 compiler。
  - 解法：在閉包裡先 `if (!confirmDelete) return;` 再解構。之後寫 handler 時，不要對可能是 `undefined` 的 state 用 `!.屬性`。
  - 狀態：已修正。

### 即將發售（2026-11-09，分支 `feat/joyu-upcoming`）

> 做法改過一次：原本放在獨立的預約索引（`dmmvideos_upcoming`），使用者覺得兩個池子之間的交接太麻煩（配信日到了要從預約那邊移走、影片頁要備援、要另外建索引），改成**跟已配信的放在同一個池子**（MySQL `dmm`＋影片索引），即將發售就是撈配信日在未來的片。第三節「做法」第 1 點作廢，以這裡為準。

- **寫入**
  - 排程 `av-upcoming-sync`（每天 05:30；手動 `-cmd av-upcoming-sync -days N` 可以縮短天數）抓 DMM 未來 30 天的預約清單（`dmm.ListUpcoming`，`excludeUndelivered: false`），明細沿用 `FetchVideo`。
  - 寫入跟每日同步走同一條路：`persistVideos` 寫 MySQL `dmm` 再寫影片索引。文件多三個欄位：`release_status`（`PRE_ORDER`）、`bookmark_count`、`fetched_at`。
  - 配信當天，每日同步用同一個番號覆寫同一筆，這三個欄位跟著消失，**已上市的不用刪**。
  - 寫入保護沿用每日同步的 `videoWritesAllowed`：只有正式環境、或 `DMM_VIDEO_INDEX` 換成測試索引時才寫。
- **DMM 的 `releaseStatus` 不可靠**（2026-11-09 探測）
  - 同一天的預約作品，有的清單和明細都是 `PRE_ORDER`，有的是空字串。
  - 所以 `release_status` 由排程依配信日自己設：配信日在明天以後就是 `PRE_ORDER`。
  - 「排程寫過、還沒被每日同步覆寫」的作品改用 `fetched_at` 辨識（`VideoIndex.PreOrders`）。
- **重抓與清理**
  - 清單上新出現的抓明細。
  - 抓過的 7 天內不重抓；3 天內配信的超過一天就重抓；清單上的配信日跟索引裡不同（改期但仍在範圍內）也重抓。
  - 排程寫過、這次清單上卻沒有的，用番號重抓明細：
    - DMM 回新日期就覆寫，這是改期。
    - 查無就從影片索引刪除，這是取消。MySQL `dmm` 那一列留著，沒有影響。
    - 配信日是今天的不管，交給當天 10:00 的同步覆寫。
    - 改期到範圍外的不管，進到範圍內會再出現在清單上。
  - 任何一天的清單抓不到就整個中止；清單一部都沒有時，不重抓也不刪。
- **查詢**
  - `applyVideoConditions` 加上配信狀態，所有走它的查詢（搜尋、篩選統計、女優頁統計、我的追蹤、MCP）預設**只看已配信的**：
    - 已配信用 `must_not` 排除「配信日 ≥ 明天」（日本時間），沒有 vod_date 的舊資料不受影響。
    - `VideoIndexQuery.Upcoming` 為 true 時只看「配信日 ≥ 明天」。
    - 依番號查單部（影片頁）兩者都查得到，所以影片頁不用備援。
  - `StatsByActress`（女優主題統計）不走 `applyVideoConditions`，另外加上同一個已配信條件。
  - 驗證：全部 599,135、波多野結衣 4,457、兩位共演 898、女優摘要，數字都跟改之前一樣。
  - 新增的查詢介面：
    - `CountByDate`：日期列。
    - `SearchAny`：我追蹤的。
    - `RecentByQueries(soonestFirst)`：我的追蹤頁。
    - `PreOrders`、`Delete`：排程用。
  - 排序：
    - `soonest`：配信日近的在前，同一天依 DMM 收藏數。
    - `popular`：依 DMM 收藏數。
    - `bookmark_count` 帶 `unmapped_type`。
  - 影片索引是預設的 dynamic mapping，三個新欄位會在正式環境第一次寫入時自動建立。
  - API 跟原本一樣：
    - 公開：`/opendata/av/upcoming`、`/opendata/av/upcoming/dates`。
    - 個人：`/joyu/me/upcoming`。
- **前端**
  - 與獨立索引版本相同：即將發售頁、首頁下週發售、女優頁即將發售列、我的追蹤頁合併、卡片標示、影片頁預約標示。
  - `isUpcoming` 同時看 `release_status` 與配信日，配信當天每日同步還沒覆寫前不會顯示成「預約中」。
- **沒做**：MCP 的 `upcoming` 參數。
- **本機驗證**（測試索引 `dmmvideos_test_upcoming`，mapping 複製自正式影片索引）
  - 抓兩天：80 部，60 秒；再跑全部沿用，5 秒；80 部都是 `PRE_ORDER`。
  - 模擬四種情況，都如預期：
    - 改期但仍在範圍內：改回 DMM 的日期。
    - 範圍內和已過期、DMM 查無：刪除。
    - 配信日是今天：保留。
    - 改期到範圍外：保留。
  - 一般搜尋只看得到已配信的，即將發售與依番號查單部都查得到預約作品；畫面也看過。
  - 測完刪除測試索引、本機 MySQL 寫入的 80 列，以及暫時的後端設定。
- **部署**
  - 不用 migration，也不用新的 env。
  - 排程第一次執行時，大約要抓兩三千部明細，寫進 MySQL `dmm` 與影片索引；想提早有資料，可以手動跑 `-cmd av-upcoming-sync`。

### 上線後的小修（2026-11-09，分支 `fix/joyu-upcoming-images`）
- **圖片預覽延遲載入**：`ImageViewer` 原本一打開就在背景預載全部大圖，影片頁預設停在圖片預覽，等於一進頁面就抓二十幾張。
  - 新增 `preload="nearby"`：只預讀目前這張與前 1、後 2 張，翻到哪載到哪。影片頁改用這個模式。
  - 漫畫、圖集維持原本的 `all`。
  - 驗證：一打開只送出第 1～3 張，往後翻三張後才補到第 6 張。
- **沒有封面的作品**
  - DMM 對還沒放封面的作品，ps／pt／pl 網址都回 **404，內容是一張固定 90×122 的 NOW PRINTING 圖**，瀏覽器照樣會畫出來。另外有些作品（例如 AIリマスター版）的封面網址本身就是空的。
  - 後端：排程寫入前用 `dmm.CoverExists` 檢查封面，沒有就存空字串。還沒有封面的作品每天重抓一次，DMM 放上封面後隔天就會補上。
    - 檢查改用 `Range: bytes=0-0` 的 GET，只抓 1 byte。不用 HEAD，因為 DMM 對不存在的封面 HEAD 回 405 而不是 404。
  - 前端 `AvCoverImage`：
    - 空網址直接顯示「尚無封面」替代區塊，不放 `<img>`。
    - 載入結果是 90×122 佔位圖時：原圖是佔位圖才算沒有封面；換用的 `pl.jpg` 是佔位圖就退回原圖，因為像 MSOC-090 原圖是 276×276 的真封面，`pl.jpg` 才是 404。
    - 載入確認之前先隱藏圖片，不會閃出 NOW PRINTING。
- **`/upcoming` 改用共通日曆**
  - `HolidayCalendar` 新增一般資料模式：`marks`（每天一段文字）、`selectedDate`、`minDate`／`maxDate`、`hideYearNav`。帶 `marks` 時不套補班樣式，也不把沒資料的週末標紅。ETF 頁沒帶這些參數，行為不變。
  - 版面：桌機日曆在左（捲動時固定）、作品在右；手機上下排。原本的 7 天／30 天切換拿掉，日曆一次看得到整個月。

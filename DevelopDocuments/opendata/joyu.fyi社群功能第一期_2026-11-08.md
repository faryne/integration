# joyu.fyi 社群功能第一期：登入、追蹤 規格

> 狀態：已實作（2026-11-08），待 commit。分支 `feat/joyu-community-p1`。mockup：`DevelopDocuments/opendata/joyu-community-mockup/index.html`。
> 第二期（想看／看過、隱藏標籤、ICS 訂閱）、第三期（Disqus 討論、即將發售、貢獻者署名）另外規劃。

## 範圍

1. **登入**：Google 登入，加上匿名登入（不註冊也能先收藏，之後升級成 Google 帳號，收藏保留）
2. **追蹤**：女優、發售商、品牌、系列、監督、標籤，以及**搜尋條件**（在影片搜尋頁把一組條件存起來，例如「某女優 × 某品牌 × 痴女」），共用同一套資料結構
3. **我的追蹤頁**（原本的「追蹤動態」和「我的追蹤」合成一頁）：每個追蹤一區，列出**最近 N 天**的新片（預設 14 天，可切 7／14／30），更多的連到搜尋頁；區塊標題旁的愛心就是取消追蹤；沒有新片的追蹤收在下面；**刪除帳號**放在最下面
4. **首頁個人化區塊**：有追蹤女優的人，首頁最上面多一區「你追蹤的女優新片」

## 帳號設計

- 用獨立的 Firebase 專案 `joyu-firebase`，開 **Google** 和 **Anonymous** 兩種登入方式。
- **DB 不存帳號**：沒有 users 表，追蹤資料用 `firebase_uid` 當 key。要顯示名字、頭像時，前端直接拿 Firebase SDK 裡的使用者資料。
- **後端不用 session**：前端每次呼叫 API，帶 `Authorization: Bearer <Firebase ID token>`，後端驗證簽章、issuer、audience 後取出 uid。
  - 沿用 `service/auth/firebase_token.go`：新增 joyu 品牌，比對 `JOYU_FIREBASE_PROJECT_ID`。
  - 允許的登入方式改成依品牌設定：joyu 允許 `google.com` 和 `anonymous`，其他品牌維持只收 Google。
- **匿名登入的時機**：第一次按愛心時才建立匿名帳號，不在開頁時建立，否則每個爬蟲和路過的訪客都會產生一個匿名帳號。
- **匿名升級成 Google**：用 Firebase 的 `linkWithPopup`，uid 不變，收藏自然保留。
  - 如果這個 Google 帳號**之前已經登入過**（`auth/credential-already-in-use`），就改成登入那個既有帳號，再呼叫後端的合併 API，把匿名帳號的追蹤搬過去（重複的略過）。

## 資料表（MySQL 5.7）

`joyu_follows`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | bigint unsigned PK | |
| `firebase_uid` | varchar(128) | |
| `kind` | varchar(16) | `actress`／`maker`／`label`／`series`／`director`／`tag`／`search` |
| `value` | varchar(512) | 女優存 `domain:aid`（例如 `xcity:22221`），改名、同名都分得開；`search` 存正規化後的查詢字串（見下）；其他存名稱本身 |
| `created_at` | datetime | |

- unique `(firebase_uid, kind, value_hash)`：`value` 最長 512，MySQL 5.7 的 utf8mb4 索引放不下，另外存一欄 `value_hash`（`value` 的 SHA-1）做唯一索引；index `(firebase_uid, created_at)`
- **搜尋條件的正規化**：只收影片搜尋的精確條件，`actress`（加 `xcity_id`／`manual_id`／`dmm_id` 指定是哪一位）、`maker`、`label`、`series`、`director`、`tag`（可以多個，交集）。參數依名稱排序、標籤去重排序後組成查詢字串，同一組條件不論勾選順序都只會存一筆。`keyword`（模糊比對）、日期、頁碼不收。
- 每人最多 **500 筆**追蹤，超過就回 400

## 後端 API（全部要帶 token、全部 `no-store`）

路由前綴 `/joyu/me`。CF Cache Rule 只比對 `/api/opendata/av/*`，這裡不會被快取，但還是明確送 `no-store`。

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/joyu/me/follows` | 全部追蹤（輕量，只有 kind、value、顯示名稱）；前端全站共用，用來畫愛心狀態 |
| PUT | `/joyu/me/follows` | body `{kind, value}`，已經追蹤就當作成功（冪等） |
| DELETE | `/joyu/me/follows` | body `{kind, value}` |
| GET | `/joyu/me/feed?days=14` | 我的追蹤頁：最近 `days` 天（7／14／30），回傳有新片的追蹤（附部數、最新配信日、最多 6 部影片，依最新配信日排序），以及這段期間沒有新片的追蹤清單；女優附上女優資料（照片、名字），資料被刪掉的標成找不到 |
| POST | `/joyu/me/merge` | body `{anonymous_token}`：把匿名帳號的追蹤搬到目前登入的帳號 |
| DELETE | `/joyu/me` | 刪掉這個 uid 的全部追蹤；前端接著呼叫 Firebase 的 `user.delete()` 刪帳號 |

刪除 Firebase 使用者交給前端的 `user.delete()`，後端就不需要 Firebase Admin SDK 和服務帳號金鑰。

### 我的追蹤頁的查詢（最近 N 天的新片）

- **以「追蹤項目」分區、只看最近 N 天**（使用者決議）：
  - 時間線一路往回列沒有意義，太舊的直接連到搜尋頁就好；
  - 標籤這類影片量大的追蹤，每區最多 6 部，不會把女優的新片淹掉；
  - 「某女優在某品牌的痴女作品」這種組合，用「搜尋條件」追蹤處理，每組條件就是一區。
- **每個追蹤就是一組影片搜尋條件**：女優 → actress 條件（同名靠 DMM 女優 ID 分開，沿用 `videoIndexQuery`）；發售商、品牌、系列、監督、標籤 → 各自的精確條件；搜尋條件 → 整組交集。日期範圍一律是「最近 N 天（含今天，日本時間）」。
- `VideoIndex` 新增 `RecentByQueries(ctx, queries []VideoIndexQuery, since, perQuery int)`，回傳每組條件的部數、最新配信日、最多 `perQuery` 部影片。介面不放 ES 的概念；ES 實作用一個請求、每組條件各一個 filter 加 top_hits，追蹤再多也只打一次 ES。之後換 Manticore，可以改成逐組查詢。
- 回應依「最新配信日」由新到舊排序，沒有新片的追蹤另外列一份清單。
- 每區的「到搜尋頁看全部」帶同樣的條件，加上 `start_date`（N 天前），影片搜尋本來就支援。

## 前端

- **Firebase 設定**：新增 `VITE_JOYU_FIREBASE_*`。`lib/firebase.ts` 在 joyu 網域改用 joyu 的設定，不再整個停用。
- **`JoyuAuthProvider`**：掛在 `JoyuLayout`，跟主站的 `AuthProvider` 分開，主站那套是 session 流程。提供目前使用者、Google 登入、登出、`ensureUser()`（沒登入就先匿名登入）、取 ID token。
- **API**：`apis/av/joyu_me.ts` 自動帶上 Bearer token；token 過期由 Firebase SDK 自動更新。
- **頁首帳號選單**：
  - 沒登入或匿名：顯示「登入」按鈕（匿名時按了是升級成 Google）
  - 已登入：頭像選單，裡面有「我的追蹤」「登出」
- **愛心按鈕 `FollowButton`**：傳入 `kind`、`value`、顯示名稱。按下時先 `ensureUser()`，再樂觀更新、呼叫 API，失敗就退回原狀並跳 Snack。
  - **女優頁**：名字旁邊
  - **影片頁**：出演女優卡、發售商、品牌、系列、監督、每個標籤後面各一顆小愛心，位置見下面「影片頁改版」
  - **影片搜尋頁**：有關鍵字或精確條件（女優、發售商、品牌、系列、監督、標籤）時，條件列旁邊多一顆「追蹤這個搜尋」，存成 `search` 類型的追蹤。只有日期時不顯示（2026-11-08 上線後修正：原本不收關鍵字，只輸入關鍵字時按鈕不出現、搭配其他條件時關鍵字被悄悄丟掉）
- **新頁面**（麵包屑都要有）：
  - `/me/follows` 我的追蹤（使用者決議：追蹤動態和管理追蹤合成一頁）：
    - 上方兩組切換：類型篩選（全部／女優／搜尋條件／發售商／…，只列有追蹤的類型）和 7／14／30 天，都存在網址（`?days=14&kind=tag`）
    - 每個有新片的追蹤一區：類型標籤＋名稱（搜尋條件顯示成「星宮みお × MOODYZ DIVA × 痴女」）＋**愛心（取消追蹤）**＋部數；最多 6 部，桌機一排、手機橫向捲動；超過 6 部時顯示「到搜尋頁看全部」
    - 下面是「這段期間沒有新片」的追蹤，一樣有愛心可以取消；女優資料被刪掉或合併的也列在這裡，顯示找不到資料
    - 最下面是「刪除帳號」，要先跳確認對話框
    - 取消追蹤是樂觀更新：區塊先消失，失敗才放回來並跳 Snack
- **首頁**：有追蹤女優的人，最上面多一區「你追蹤的女優新片」：最近 7 天，只取女優類型的追蹤，把各區的影片合在一起依配信日排，取前 6 部（前端用 feed API 的結果自己合併，不另開 API），加上「看全部」。只用女優，避免標籤這類量大的條件把首頁塞滿。
- **影片頁改版**（使用者決議，mockup「影片頁」）：
  - **「基本資料」分頁和表格整個拿掉**。出演女優本來就有女優卡，直接從表格移除。
  - **出演女優卡右側加愛心**：整張卡是連到女優頁的連結，愛心要擋掉點擊冒泡，按愛心不會跳頁。只有對得到唯一一位女優資料的卡片才有愛心（追蹤要存 `domain:aid`）；同名多位或還沒建檔的，維持只有名字，沒有愛心。
  - 發售商、品牌、系列、監督、標籤改成**標題下方各一列**（標籤可以多個），值點了照舊進影片搜尋（同現在的精確篩選），後面是愛心。
  - 下方分頁只剩同系列作品、女優的其他作品、同監督作品、同品牌作品；預設停在第一個有內容的分頁。

## 需要你手動做的

1. Firebase console 的 `joyu-firebase`：Authentication 開 **Google** 和 **Anonymous** 兩個登入方式。
2. Authorized domains 加上 `joyu.fyi`；本機測試要再加 `joyu.localhost`。
3. 專案設定新增一個 Web app，把設定值（apiKey、authDomain、projectId、appId…）給我，或你直接填進 `static_site/.env` 的 `VITE_JOYU_FIREBASE_*`。
4. 後端環境變數 `JOYU_FIREBASE_PROJECT_ID=joyu-firebase`（本機和正式機都要）。
5. 部署前跑新的 migration。

## User stories

- 沒登入的讀者在女優頁按愛心，馬上就收藏成功（背後建立了匿名帳號），之後在「我的追蹤」頁看得到她的新片。
- 讀者按「登入」用 Google 登入，原本匿名時的收藏都還在。
- 讀者換一台電腦用同一個 Google 帳號登入，看到一樣的追蹤。
- 讀者在影片頁追蹤某個發售商和標籤，「我的追蹤」頁各多一區，列出它們最近 N 天的新片；標籤新片很多時只放 6 部，旁邊可以到搜尋頁看全部。
- 讀者在影片搜尋頁篩出「某女優 × 某品牌 × 痴女」，按「追蹤這個搜尋」；之後這組條件有新片，「我的追蹤」頁就會出現一區。
- 有追蹤的讀者打開首頁，第一眼就看到追蹤對象的新片。
- 讀者在「我的追蹤」頁刪除帳號，確認後追蹤資料和 Firebase 帳號都被刪掉，畫面回到未登入狀態。

## 常見 fail 與對應

| 狀況 | 對應 |
|---|---|
| ID token 過期（一小時） | Firebase SDK 的 `getIdToken()` 會自動更新；後端回 401 時前端強制更新 token 再重試一次 |
| 登入彈窗被瀏覽器擋 | 跳 Snack 提示允許彈出視窗，不改成 redirect 流程（redirect 會打斷正在看的頁面） |
| 匿名升級時，這個 Google 帳號早就有了 | 登入既有帳號，再呼叫合併 API，把匿名帳號的追蹤搬過去 |
| 追蹤超過 500 筆 | 後端回 400，前端 Snack 顯示上限 |
| 追蹤的女優資料被刪掉或合併 | 列在「這段期間沒有新片」那區，顯示「找不到資料」，可以取消；查新片時略過這筆 |
| 我的追蹤頁沒有任何追蹤 | 沒追蹤：顯示前往女優頁的按鈕；有追蹤但這段期間都沒新片：只顯示下方的追蹤清單 |
| 刪帳號時 Firebase 要求重新登入（`auth/requires-recent-login`） | 先跳 Google 重新驗證，通過後再刪 |
| 本機測試 | 匿名登入不需要彈窗，我可以在本機自己跑完追蹤、動態、合併以外的流程；Google 登入的部分要你手動試 |

## 決議（2026-11-08）

1. **登入方式只做 Google ＋ 匿名**，Email 登入之後再說（Email 密碼登入要處理驗證信和重設密碼的動作網址，neko 帳號當初就卡在這裡）。
2. **每人追蹤上限 500 筆**。
3. **一直沒升級的匿名帳號第一期先不處理**，追蹤資料會留在 DB；之後量變大再加清理排程。
4. **影片頁拿掉「基本資料」表格**，各欄位加愛心列在標題下方，出演女優卡也有愛心。
5. **組合條件用「追蹤這個搜尋」**（影片搜尋頁），追蹤列表只看最近 N 天、每個追蹤一區。
6. **「追蹤動態」和「我的追蹤」合成一頁**（`/me/follows`）。

## 順手修正

- **女優頁頂端的別名 chip 置中**（使用者回報，美園和花頁）：`ActressNames`、`ActressTopicChip` 還留著舊版側欄卡片的 `justifyContent: center`，P2 改成頂端資料區後就跑到中間，現在改成靠左。

## 實作紀錄（2026-11-08）

### 後端
- `service/auth`：新增 `BrandJoyu`，`firebaseProjectID` 對 joyu 一律用 `JOYU_FIREBASE_PROJECT_ID`（不退回主站專案）；`allowedSignInProvider` 讓 joyu 另外接受 `anonymous`。
- `middleware/joyuauth`：驗證 `Authorization: Bearer`，uid 放進 Locals；驗不過回 401。
- `migration/20261108120000-create_joyu_follows.sql`、`repository/av/joyu_follow.go`（讀取一律走 primary）、`service/av/joyu_follow.go`（正規化、上限、合併、刪帳號）、`service/av/joyu_follow_feed.go`（我的追蹤頁）。
- `VideoIndex.RecentByQueries`：ES 用一個請求，每組條件一個 filter，底下 max 取最新配信日、top_hits 取最新 6 部。
- `controller/joyu`、`route/joyu.go`：`/joyu/me/*`，群組掛 `httpcache.NoStoreByDefault()` 和 `joyuauth.New()`。

### 前端
- `lib/joyuFirebase.ts`：具名 Firebase app（`joyu`），跟主站的 `lib/firebase.ts` 完全分開。
- `components/joyu/auth/`：`JoyuAuthProvider`（掛在 `JoyuLayout`）、`JoyuAccountMenu`（頁首）。匿名升級成 Google 時 Firebase 是原地修改同一個 User 物件，用一個 version state 強制重畫。
- `components/joyu/useFollowToggle.ts`：追蹤切換的共用邏輯；`FollowButton`（愛心）和 `SearchFollowButton`（「追蹤這個搜尋」）都用它。
- `helpers/joyuSearchFollow.ts`：前端組搜尋條件 value 的規則跟後端 `normalizeSearchFollow` 一樣（編碼跟 Go 的 `url.Values.Encode` 對齊），才能直接比對是否已追蹤。
- 影片頁：`VideoMetaRows` 取代原本的「基本資料」表格，`VideoDetailTabs` 拿掉基本資料分頁；`video_links_row.tsx` 沒人用了，刪掉，參考連結改用 `ActressLinks` 顯示在資料列最後。
- 影片搜尋頁：網址支援 `xcity_id`／`manual_id`／`dmm_id`（只在有「出演」條件時生效，拿掉出演就一起清掉），從我的追蹤頁「到搜尋頁看全部」時同名女優才分得開。
- `pages/joyu/MyFollows.tsx`（`/me/follows`）、`components/joyu/follows/`、首頁 `FollowedActressesSection`。

### 本機驗證（匿名登入）
- 沒登入按女優頁愛心 → 自動建立匿名帳號並追蹤成功，頁首出現帳號選單。
- 影片頁追蹤發售商、標籤；按愛心不會觸發外層 chip 的跳頁。
- 影片搜尋頁「追蹤這個搜尋」→ 按鈕變「已追蹤這個搜尋」。
- 我的追蹤頁：四種追蹤各一區，依最新配信日排序；切 7 天後沒新片的移到下方；取消追蹤後數量即時更新。
- 首頁：追蹤這週有新片的女優後，最上面出現「你追蹤的女優新片」。
- 刪除帳號：確認後資料表清空、Firebase 匿名帳號刪除、回到首頁。
- **沒有自動化測到的**：Google 登入、匿名升級成 Google（`linkWithPopup`）、升級時遇到既有帳號的合併流程，需要彈窗互動，要使用者手動測。

### 本機環境備註
- 本機資料庫記錄了一支這個目錄裡沒有的 migration（`20260918100000-add_actor_to_storyteller_versions.sql`），`make mig-up` 會拒絕產生計畫；這次是在本機 MySQL 容器直接執行新表的 SQL（`CREATE TABLE IF NOT EXISTS`，之後正常跑 migration 不會衝突）。

## 已知 Bug 記錄

### 剛簽發的 Firebase token 被後端拒絕（2026-11-09 修正）
- **現象**：沒登入的人第一次按愛心或想看時，系統會當場建立匿名帳號，但第一下必定失敗（401「登入已失效，請重新登入」），重新整理後再按才會成功。2026-11-08 本機測試時偶發過一次，2026-11-09 測片單時穩定重現。
- **Root cause**：
  - `service/auth.VerifyFirebaseIDToken` 用的是 `golang-jwt/jwt/v4` 的 `RegisteredClaims.Valid()`，檢查 `iat` 時不容許任何時鐘誤差。
  - 剛簽發的 token，`iat` 就是 Google 那邊的「現在」。伺服器時鐘只要慢一點點，就會被判成「還沒生效」。
  - 前端遇到 401 會強制換新 token 重試，但換來的也是剛簽發的，所以重試一樣失敗。
  - 舊 token 回 200、強制換新的 token 立刻回 401，可以穩定重現。
- **解法**：在 `firebaseClaims` 覆寫 `Valid()`，exp／iat／nbf 都容許 5 分鐘誤差（比照 Firebase Admin SDK），並加上測試 `TestFirebaseClaimsValidClockSkew`。這個函式是主站、SteamLoom、joyu 共用的，三邊都會受惠。
- **狀態**：已修正（分支 `feat/joyu-video-marks`）。

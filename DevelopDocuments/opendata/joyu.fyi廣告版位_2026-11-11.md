# joyu.fyi 廣告版位（adultforce）＋被擋時的站內推廣

> 狀態：已實作（`feat/joyu-ads`、`feat/joyu-ad-units`、`feat/joyu-ad-adtng`），adultforce 廣告已填入
> Mockup：`DevelopDocuments/opendata/joyu-ads-mockup/index.html`

## 範圍

- 只在 joyu.fyi 出現（`isJoyuSite()`）；faryne.dev 的 `/av/*` 不放。
- 尺寸：PC 728×90、手機 300×100，用 MUI breakpoint 切換（`md` 以上 PC）。
- 版位，共 4 格：
  - 首頁兩格：「今天有新片的女優」之後、「女優主題」之後（即將發售之前）。
  - 女優頁一格：header 與 tabs 之間。
  - 影片頁一格：封面／資訊區與 tabs 之間。
- 其他頁（搜尋、我的追蹤、upcoming、討論）先不放。

## 版位狀態

| 狀態 | 畫面 |
|------|------|
| loading | 固定尺寸的空框（先佔好高度，版面不跳） |
| loaded | adultforce 廣告；框左上角小字「廣告」 |
| blocked | 同尺寸改放站內推廣；不顯示「廣告」、不要求關 adblock |

**判定被擋**的條件，任一成立即算被擋：

1. 廣告 script `onerror`，被網路層擋掉的情況。
2. 載入後 3 秒內，版位容器裡還沒有 iframe/img，或高度是 0。這涵蓋 cosmetic filter 把廣告藏起來、或廣告商沒填單。

沒填單也一起改放站內推廣，對使用者來說效果相同，不另外區分。

## 站內推廣內容

### 第一版：女優主題

- **資料來源**：CDN 上的 `actress-topics/index.json`，與主題總覽頁共用同一份 React Query 快取，不打新 API。
- **挑選方式**：從主題裡隨機挑一個，同一頁有多格時不重複。
- **顯示**：
  - kicker「女優主題」。
  - 主題名稱＋人數。
  - 頭像：PC 6 個、手機 3 個。
  - PC 有「看主題 →」；手機放不下，拿掉這段字，整格本來就可點。
- **連結**：`joyuPath("actress/topics/<slug>")`。

**後端小改（週排程）**：`ActressTopicSummary` 加 `preview`，內容是作品數前 6 名的 `{aid, name, photo}`。

- 理由：頭像目前只存在各主題檔案裡，有的主題一千多人，為了 6 張臉去抓整份檔不划算。index.json 只會多出幾十 KB 以內。
- 舊的 index.json 沒有 `preview` 時就不顯示頭像，部署後下一次排程跑完才會有。

### 之後：影片主題

影片主題做好時，加一個 source 進來就好，`AdSlot` 本身不用動。

## 共用設計（之後給別的站用）

```
components/common/promo/
  AdSlot.tsx          // 版位外框：尺寸、狀態機、被擋判定；廣告 provider 與推廣 source 都由 props 注入
  HousePromo.tsx      // 推廣卡片的共用版面（kicker／標題／數字／頭像／連結）
  types.ts            // AdProvider、HouseSource 介面
  units.ts            // AdUnit（廠商的一個 zone）、iframe／script loader、依權重挑單元的 unitsProvider
components/joyu/promo/
  slotProvider.ts     // 依版位名稱取 provider（總開關＋本機開關）
data/joyuAdUnits.ts   // joyu 廣告設定：總開關、版位名稱、各版位的廣告單元
  actressTopicSource.ts // HouseSource 實作（之後再加 videoTopicSource）
```

- `HouseSource`：`useItems(): HousePromoItem[] | undefined`，回傳可輪播的推廣項目。多個 source 合在一起之後再隨機挑。
- `AdProvider`：`load(container, size) → Promise<void>`，負責插 script／iframe，失敗時 reject。
- 別的站（galgame／neko）要用時，只要換自己的 provider 和 source。站點專屬的東西不放進 `common/`。

## 陷阱

- **class 名稱不能帶 `ad`／`ads`／`banner`／`sponsor`**：EasyList 的 cosmetic 規則會連站內推廣一起藏掉。容器用中性名稱，例如 `jy-slot`；MUI 的 `sx` 產生的是 hash class，不受影響，但不要額外加語意 class。
- **CLS**：外框一律先佔固定高度（90／100 + 標籤列），廣告晚到或被擋都不會推動下方內容。
- **成人廣告的內容尺度**由廣告商控制，站內這邊管不到。若要限制只出靜態圖或排除 pop-under，要在 adultforce 後台設定 zone 類型。
- **CSP**：目前沒有設 CSP。若之後要加，需放行 adultforce 的 script／frame 網域。
- **本機開發**：預設不載真廣告，直接走 blocked，方便看站內推廣。可用 `VITE_JOYU_ADS=1` 開啟真廣告測試。

## 需要使用者提供

- 各廠商的嵌入碼（兩個尺寸各一），填進 `data/joyuAdUnits.ts`；確認是 script 插入還是 iframe。

## User story

- 訪客沒裝 adblock：在版位看到 adultforce 廣告，版面不跳動。
- 訪客有 adblock：看到隨機一個女優主題的推廣，點了進主題頁，不會被要求關 adblock。
- 主題 JSON 讀取失敗：整格收起，不跳 snack，因為這不是使用者操作造成的錯誤。

## 實作紀錄（2026-11-11）

- 後端：`ActressTopicSummary.Preview`（`model/entity/opendata/av/actress_topic.go`）＋ `topicPreview()`（`service/av/actress_topic_build.go`，出演數前 6、跳過沒照片的，測試 `TestTopicPreview`）。
- 共用：`static_site/src/components/common/promo/`
  - `types.ts`：`PromoSize`／`PROMO_SIZES`／`AdProvider`／`HousePromoItem`／`HouseSource`。
  - `AdSlot.tsx`：依 md 斷點選尺寸，跨斷點時以 `key` 整格重建；provider reject 或 3 秒後容器沒有可見子元素 → blocked。
  - `HousePromo.tsx`：整格 RouterLink，`box-sizing: border-box`（joyu 沒有全域 border-box，不加會變 326×102）。
- joyu：`static_site/src/components/joyu/promo/`
  - `slotProvider.ts`：依版位名稱取 provider；本機要 `VITE_JOYU_ADS=1` 才載真廣告。
  - `actressTopicSource.ts`：index.json → 推廣卡片，只收有頭像的主題。
  - `JoyuAdSlot.tsx`：非 joyu 網域回傳 null。
- 版位：`pages/joyu/Home.tsx`（slot 0、1）、`components/av/actress_detail.tsx`、`components/av/video_detail.tsx`。
- 置中：外框在 `Stack` 裡時 spacing 會把 margin 蓋成 0，所以用 `alignSelf: center`＋`mx: auto`。

### 部署注意

- 前後端都要部署；部署後**手動跑一次女優主題排程**（`-cmd av-actress-topics`），index.json 才會有 `preview`。在那之前推廣內容是空的，版位整格收起（沒設廣告網址時等於看不到任何東西，屬預期）。
- 廣告網址填在 `static_site/src/data/joyuAdUnits.ts`（進 repo，不放 `.env`），改完重新部署前端。

### 驗證

- 本機用正式 index.json 補上 preview 的假 CDN 驗證：首頁兩格主題不同；PC 728×90（6 頭像＋看主題）、手機 300×100（3 頭像、文字與頭像不重疊）；女優頁、影片頁版位在 tabs 正上方；faryne.dev 的 `/av` 頁不出現。
- **未驗證**：真的 adultforce 廣告載入／被擋的切換（沒有嵌入碼）。

## 多廠商／多單元設定（2026-11-11 第二輪）

原本每個尺寸一個 env 變數，只撐得住單一廠商；改成 repo 內的設定檔 `static_site/src/data/joyuAdUnits.ts`：

- `JOYU_ADS_ENABLED`：總開關（目前 `true`）。關掉時全部版位只放站內推廣。
- `JOYU_AD_PLACEMENTS`：`home-1`、`home-2`、`actress`、`video`；`<JoyuAdSlot placement=… />` 依名稱取廣告，也用順序錯開推廣內容。
- `DEFAULT_UNITS`：沒個別設定的版位共用；`PLACEMENT_UNITS` 可覆寫個別版位。
- `AdUnit`：`vendor`、`type`（`iframe`／`script`）、`src.desktop`／`src.mobile`、`attrs`（script 要帶的 data-* 等）、`weight`（同版位多單元依權重隨機）。
- 某尺寸沒填網址的單元不會在那個尺寸出現；一個版位完全沒有可用單元時直接放站內推廣（不等 3 秒）。
- 嵌入網址不是機密，進 repo；`.env` 只剩本機的 `VITE_JOYU_ADS=1` 開關。
- script 型嵌入要用 async 版本；`document.write` 的舊式嵌入碼在 SPA 裡不能用。
- 驗證：在瀏覽器直接 import `units.ts` 測過：沒有單元／沒有網址時 provider 是 undefined、iframe 正常插入（728 寬）、iframe 網址被擋時 reject、沒有該尺寸時 reject、script 載入失敗時 reject。

## 填入 adultforce 廣告（2026-11-11 第三輪）

- 嵌入碼都是 `a.adtng.com/get/<spot id>?ata=faryne` 的 iframe（`ata` 是帳號代碼），寫在 `DEFAULT_UNITS`，四個版位共用：
  - 10001811（728×90）＋10001817（300×100）
  - 10002801（728×90）＋10002802（300×100）
  - 10001814（只有 300×100，只在手機出現）
- 嵌入碼給的是 `//a.adtng.com`，設定檔固定寫 `https`。
- **試探改打主機根網址**：原本 `fetch(no-cors)` 打的是廣告網址本身，會讓廣告伺服器多算一次曝光（可能被當成無效流量）；改成只打 `https://a.adtng.com/`。adblock 清單多半整個網域擋，一樣測得出來。
- 驗證：在瀏覽器確認設定檔讀出的網址與試探網址正確。**刻意沒有在本機載真廣告**，避免自己產生曝光；要看實際效果可在本機設 `VITE_JOYU_ADS=1`（會算曝光），或部署後到正式站看。

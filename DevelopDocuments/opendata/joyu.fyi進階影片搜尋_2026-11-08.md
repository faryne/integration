# joyu.fyi 進階影片搜尋（2026-11-08）

> 狀態：已實作（2026-11-09），待 commit。分支 `feat/joyu-advanced-search`（已含「追蹤搜尋收關鍵字」的修正）。
> Mockup：`DevelopDocuments/opendata/joyu-advanced-search-mockup/index.html`

## 背景（使用者回報）

1. 影片搜尋頁的表單只有關鍵字、開始日期、結束日期；出演、發售商這些條件只能從「篩選」面板點選。
2. 出演、標籤以外的條件都只能選一個，沒辦法同時搜多位女優、多個品牌。
3. 「追蹤這個搜尋」不收關鍵字（已修，見文末）。

## 決定事項（已確認）

### 1. 表單欄位

| 欄位 | 輸入方式 | 多選時 | 備註 |
|---|---|---|---|
| 關鍵字 | 文字 | — | 現有 |
| 出演 | 多選 autocomplete | **交集**（同時出演） | |
| 標籤 | 多選 autocomplete | **交集**（全部符合） | 現有參數 `tag` |
| 發售商／品牌／系列／監督 | 多選 autocomplete | **聯集**（任一個） | 一部片通常只有一個，交集一定沒結果 |
| 配信日期 | 起訖 | — | 現有 |
| 片長 | 最短～最長（分鐘） | — | 新增，索引已有 `duration` |
| 排序 | 結果區右上的下拉 | — | 新到舊（預設）／舊到新 |

- autocomplete 直接沿用影片修改表單的 `VideoTermAutocomplete` 與 `/opendata/av/video/suggest`。後端已有：依「包含輸入字」查詢，按作品數排序取前 10 個，並用 Redis 快取 1 小時。搜尋時**不能自由輸入**，只能挑清單裡的值，因為這些條件是完全比對，打錯就查不到。
- 表單常駐：關鍵字、出演、標籤、配信日期；其餘收在「更多條件」，有值時預設展開。
- **不加番號欄位**：頁首搜尋框貼番號就會直接進影片頁。
- 欄位標題直接標出交集或聯集：「出演（同時出演）」「發售商（任一）」，否則使用者不知道多選怎麼算。

### 2. 網址參數

- 多值一律用重複參數：`actress=A&actress=B&maker=X&maker=Y`。舊網址的單值寫法（`maker=X`）照樣能用，影片頁 chip、女優頁連結都不必改。
- 新增 `duration_min`、`duration_max`（分鐘）與 `sort=oldest`（不帶就是新到舊）。
- `xcity_id`／`manual_id`／`dmm_id`（指定是哪一位）**只在剛好一位出演時生效**；兩位以上只照名字比對。同名女優共演的情況少到可以不管，這是最簡單的做法。

### 3. 結果區

- 條件 chip 一個值一個，每個都能移除；關鍵字、日期、片長的 chip 現在不能移除，這次一起補上。
- 「篩選」面板：發售商、系列、出演原本是單選（點另一個會換掉），改成跟標籤一樣，點了加入、再點一次移除。

### 4. 追蹤這個搜尋

- 多值照存，每個參數的值去重、排序。這樣同一組條件不論點選順序如何，都存成同一筆追蹤。
- 兩位以上出演時不存女優 ID（跟搜尋規則一致）。
- 片長、排序**不存**：追蹤看的是「最近 N 天的新片」，排序沒有意義；片長先不收，免得追蹤條件太細。
- 顯示名稱：聯集的值用「／」連起來，條件之間用「 × 」。例：「「コスプレ」 × 星宮みお × 美園和花 × MOODYZ／S1 × 痴女」。
- 已存在的追蹤都是單值，格式不變，不用搬資料。

### 5. MCP（`av_video_search`）

- `actress`／`maker`／`label`／`series`／`director` 改成接受字串或字串陣列，跟 `tag` 一樣；描述寫清楚哪些取交集、哪些取聯集。
- 新增 `duration_min`、`duration_max`、`sort`。

## 影響檔案

| 層 | 檔案 | 內容 |
|---|---|---|
| model | `model/entity/opendata/av/video.go` | `Actress`／`Maker`／`Label`／`Series`／`Director` 改成 `[]string`，新增 `DurationMin`、`DurationMax`、`Sort` |
| model | `model/entity/opendata/av/video_index.go` | `VideoIndexQuery.Actress` 改成 `Actresses []VideoActressFilter` |
| repository | `repository/av/video_index_es_query.go` | 每位出演各一個 must（交集）；發售商等改成 `terms`（聯集）；片長 `range` |
| repository | `repository/av/video_index_es.go` | 排序 |
| service | `service/av/search.go` | `videoIndexQuery`：一位出演時照舊解析 ID，多位時逐一照名字 |
| service | `service/av/joyu_actress_summary.go`、`actress_videos.go`、`joyu_follow_feed.go`、`joyu_follow.go` | 跟著改型別；追蹤正規化收多值 |
| service | `service/mcp/av_tools.go` | 參數改成字串或陣列，新增片長、排序 |
| route | `route/opendata.go` | `/av/video/suggest` 加上 `avCache`（目前沒有 CDN 快取，搜尋頁的打字頻率比修改表單高很多） |
| 前端 | `helpers/avVideoSearchParams.ts`、`data/avVideoFilters.ts`、`apis/av/video_search.ts` | 多值參數、片長、排序 |
| 前端 | `components/av/video_search.tsx` | 新表單（含「更多條件」） |
| 前端 | `pages/av/video.tsx` | chip 一值一個、都能移除，排序下拉，篩選面板改成可複選。這個檔目前 334 行，chip 列會抽成獨立元件，避免超過 500 行 |
| 前端 | `helpers/joyuSearchFollow.ts` | 跟後端同一套多值正規化 |
| 前端 | `apis/av/video_submission.ts` | `useVideoTermSuggest` 搬到中性的 `apis/av/video_suggest.ts`，修改表單和搜尋頁共用 |

## User story

- 我想找「星宮みお 和 美園和花 共演、MOODYZ 或 S1 出的、有痴女標籤」的片：出演挑兩位、發售商挑兩個、標籤挑痴女，按搜尋。
- 我在搜尋結果的篩選面板又點了一個發售商，它加進條件裡，原本選的沒有被換掉。
- 我把這組條件按「追蹤這個搜尋」，之後在我的追蹤頁就會看到它最近的新片。
- AI 透過 MCP 用同樣的條件搜尋，結果跟網站一致。

## 常見失敗與處理

| 情況 | 處理 |
|---|---|
| autocomplete 打字太快、請求太多 | 前端 300ms debounce（現有）＋後端 Redis＋這次加的 CDN 快取 |
| 舊網址帶單值 | 後端把單值當成一個元素的陣列，前端解析也一樣 |
| 多位出演又帶了 `xcity_id` | 忽略 ID，照名字比對 |
| 片長最短大於最長 | 前端輸入時自動對調（比照女優搜尋的身高欄位）；後端照收，查不到就是 0 筆 |
| 有些影片片長是 0（沒資料） | 有設片長條件時這些影片會被排除，符合「我要篩片長」的預期 |
| 篩選面板點選後，表單裡還沒按搜尋的輸入被蓋掉 | 跟現在一樣：篩選面板以網址上的條件為準，點了表單會同步成網址的條件。這次不改 |

## 已修：追蹤搜尋收進關鍵字

原本把關鍵字當成模糊比對、不收進追蹤，結果只輸入關鍵字時按鈕不會出現；搭配其他條件時，關鍵字會被悄悄丟掉。現在關鍵字也算一個條件，前端 `helpers/joyuSearchFollow.ts` 與後端 `normalizeSearchFollow` 同步修改。本機驗證：追蹤「コスプレ」後，我的追蹤頁列出 14 天內 69 部。

## 實作紀錄（2026-11-09）

### 跟規格不同或補充的地方
- `data/avVideoFilters.ts` 把標籤也併進 `AV_VIDEO_EXACT_FILTERS`，並加上 `field`（suggest 欄位）與 `match`（all／any）。表單、條件 chip、網址解析都只讀這一份清單；`AV_VIDEO_TAG_LABEL` 已移除。
- 條件 chip 列抽成 `components/av/video_search_chips.tsx`，`pages/av/video.tsx` 從 334 行降到約 270 行。
- `useVideoTermSuggest` 搬到 `apis/av/video_suggest.ts`；`VideoTermAutocomplete` 在搜尋表單用 `freeSolo={false}`，因此會自動反白第一個選項，按 Enter 選取後不會直接送出表單。
- 女優頁的出演、女優摘要 API 改成送陣列（`actress: [name]`），`useJoyuActressSummary` 加上 `paramsSerializer: { indexes: null }`。
- MCP 新增共用的 `stringsSchema`，`tag` 也改用它。

### 順手修的（第一期就有的問題）
- `useToggleFollow` 失敗時要把清單還原成送出前的值。但如果追蹤清單從來沒讀成功過（例如登入狀態失效、GET 也是 401），送出前的值是 `undefined`，React Query 的 `setQueryData(undefined)` 不會動作，按鈕就停在「已追蹤」。改成這種情況下直接移除該 query，讓它重讀。

### 本機驗證
- API：
  - 波多野結衣一位 4,457 部；加上大槻ひびき共演後 898 部，跟篩選統計的數字一致。
  - 兩位出演同時帶 `xcity_id`，ID 會被忽略，一樣是 898 部。
  - 發售商：ムーディーズ 10,991 部，加上エスワン後聯集為 18,822 部。
  - `duration_min=300` 只回傳 300 分鐘以上的片；`sort=oldest` 第一部是 2002 年。
  - `/av/video/suggest` 回應帶 `public, max-age=60, s-maxage=600`。
- 畫面：
  - 打字後從標籤清單挑「痴女」並送出，結果剩 22 部。
  - 篩選面板點第三位出演（AIKA）會加入條件，再點一次會移除。
  - 每個條件 chip 都能移除；排序切成舊到新正常。
  - 手機寬度版面正常。
- 追蹤：
  - 多值條件存成排序過的值，不含片長和排序。
  - 重新整理後按鈕仍是「已追蹤」，表示前後端的正規化一致。
  - 我的追蹤頁顯示「大槻ひびき × 波多野結衣 × ムーディーズ × 痴女」。
- 女優頁（資料筆數、共演、影片列表）與影片頁的相關作品分頁都正常。

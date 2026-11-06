# 搜尋引擎抽象層＋Manticore adapter 規格（草稿）

- 狀態：規格草稿第二版，待使用者確認後才實作（2026-11-06）
- 背景：prod 要從 Linode（ES 7.x）收回 AWS 東京，ES 吃記憶體是無法縮機器的主因。目標是能逐領域從 ES 切到 Manticore，過渡期可雙寫、可比對、可退回。
- 已確認：試點用 **AV 影片**；nekomaid、taipower 在 MySQL 有完整原始資料；galgame 索引目前沒有讀取端，但**繼續維持寫入**。
- **限制**：prod 的 Manticore 主機還沒準備好。在那之前，Manticore adapter 只能在本機 container 用小量資料測試，**無法做大規模驗證**；影子比對、雙寫、容量量測都要等主機裝好才能做。

## Manticore 未安裝前的原則

1. **程式碼併進 main 後，prod 行為必須完全不變。** 所有 `SEARCH_ENGINE_*` 預設都是 `es`，沒有設 `MANTICORE_DSN` 時就不建立連線，啟動也不會失敗。
2. **設定錯了要在啟動時就擋下來。** 如果某個領域設成含 `manticore`，但 `MANTICORE_DSN` 是空的，啟動直接報錯，不要等到第一個請求才出錯。
3. **本機測試用小量樣本。** 本機跟 prod 共用 ES，回填指令從 ES 讀資料是唯讀的，但全量掃描會增加 prod ES 的負載，所以回填指令要有 `-limit`，本機只抽幾萬筆來測。
4. **本機的 Manticore 版本要固定。** `docker-compose.yml` 現在用的是沒加 tag 的 `manticoresearch/manticore`（等於 latest），要改成固定版本，之後 prod 主機也裝同一版，免得本機驗證過的語法到了 prod 不能用。
5. **PoC 項目在本機能驗證的是「語法和行為對不對」，驗證不了「效能和容量夠不夠」。** 後者標成 prod 待驗，等主機裝好再處理。

## 目標

1. 各領域的搜尋讀寫都經過**領域介面**，換引擎只改設定，不改 service／controller。
2. 過渡期支援「讀 A、雙寫 A＋B、影子比對 B」，**每個領域各自切換**。
3. 全部切完後，移除 ES adapter、`go-elasticsearch` 依賴與 Linode 主機。

非目標：繁簡正規化（OpenCC）、相關度調校、Manticore 叢集／HA。

## 現況盤點

ES 散在 6 個領域、15 支檔案；`service/search` 只是 ES DSL 的 map 組裝器（`SetQuery` 被呼叫 70 次），**ES 回應型別 `entity.ElasticSearchResponse[T]` 一路外漏到 controller**（`Hits.Total`、`Hits[].Sort` 當 search_after 游標、`Aggregations`）。

| 領域 | 索引（prod 大小／筆數） | 寫入方式 | 讀取用到的 ES 功能 | 回填來源 |
|---|---|---|---|---|
| **av 影片** | `dmmvideos`（**1.8GB／59.9 萬筆**，另有 12.9 萬筆已刪除文件未合併） | Index／Update（partial）／UpdateByQuery（painless） | bool、range、term(s) `.keyword`、**wildcard 子字串**、function_score random、Mget、terms aggs（facets／建議） | **ES**（舊片只存在 ES） |
| nekomaid | `nekomaid`（66MB／7.4 萬） | Index／DeleteByQuery（禁抓） | match、sort | MySQL |
| nccc | `nccc_*` 共 18 個（約 220MB／134 萬，**動態欄位、動態索引**） | Bulk／DeleteByQuery | terms、search_after、列出索引 | ES 或重新下載開放資料 |
| taipower | `taipower_neighbor`（52MB／12.2 萬） | Bulk | search_after、composite aggs＋sum | MySQL |
| galgame | `galgame_videos`＋`galgame_brands`（36MB／1.5 萬） | Index／Delete | **無讀取端**，只維持寫入 | MySQL |
| av 女優 | `dmmactresses`（13MB／5.9 萬） | Index | bool、term、sort、composite aggs（主題統計） | MySQL |
| storyteller | `storyteller_works`（1.8MB／73） | Index／Delete／DeleteByQuery | multi_match、collapse、cardinality、search_after | MySQL |

合計約 2.3GB，**AV 影片就佔 78%**。拿它當試點，等於先驗證最壞的情況：資料量最大、查詢最複雜、而且只能從 ES 匯出。

> `storyteller_works_dev` 是本機開發用的索引，不需要搬。

## 設計決策

### 1. 介面切在「領域」，不做通用 DSL 翻譯器

不把 ES bool DSL 翻成 Manticore：`function_score`、`.keyword` 子欄位、wildcard、composite aggs、painless script 都要特例處理，最後只會變成一個半套的 ES 模擬器。改成：

- 每個領域定義自己的介面，輸入是**既有的 typed request**（例如 `av.VideoQueryRequest`），輸出是領域型別。
- **ES adapter＝把現有程式碼原封搬進去**，行為零變更；Manticore adapter 另寫 SQL。
- 雙寫／影子比對是共用的組合層，不碰查詢語法。

### 2. 放在 `repository/`

AGENTS 規定資料存取放 `repository/`；Manticore 走 SQL 本來就是資料存取。輪到哪個領域，就把該領域散在 `service/` 的 ES 程式碼搬過去，**還沒輪到的領域不動**。

```
repository/search/                        # 共用：Page（P0）；Engine、組合層、影子比對、字串雜湊（P1）
repository/<domain>/<x>_index.go          # 領域介面＋組合（依設定挑 adapter），例如 repository/av/video_index.go
repository/<domain>/<x>_index_es*.go      # ES adapter（搬現有程式碼；查詢組裝另放 _es_query.go）
repository/<domain>/<x>_index_manticore.go # Manticore adapter
service/client/manticore.go               # Manticore 用的 *sql.DB，跟 mysql／redis／elasticsearch client 放一起
```

### 3. 共用型別

```go
// Page 取代外漏到 controller 的 ES 回應；Cursor 是不透明字串（base64 JSON），取代 ES 的 Hits[].Sort
type Page[T any] struct {
	Items  []T
	Total  int64
	Cursor string
	Stats  map[string]float64 // 只放目前用到的單值統計，例如 taipower 的 total_cash
}
```

### 4. 切換設定：每個領域一個開關

```
SEARCH_ENGINE_AV_VIDEO=es                # 只用 ES（預設，等於現況）
SEARCH_ENGINE_AV_VIDEO=es+manticore      # 讀 ES；同時寫 Manticore；依取樣率影子比對 Manticore
SEARCH_ENGINE_AV_VIDEO=manticore+es      # 讀 Manticore；ES 繼續寫，保留退路
SEARCH_ENGINE_AV_VIDEO=manticore         # 只用 Manticore
SEARCH_SHADOW_RATE=0.1                   # 影子比對取樣率，0＝關
MANTICORE_DSN=tcp(127.0.0.1:9306)/       # Manticore 走 MySQL protocol
MANTICORE_TABLE_PREFIX=                  # 本機測試可加前綴，避免寫進 prod 的表（同 DMM_VIDEO_INDEX 的做法）
```

- 「`+` 前面」＝讀取與主要寫入引擎，失敗就回錯；「`+` 後面」＝次要寫入，**失敗只記 zap warn，不中斷 job**。
- **影子比對**：主引擎回應後，非同步（500ms timeout）用次要引擎跑同一個查詢，只記 log：`total` 差異、前 10 筆 key 的交集比例。不影響回應時間。
- 讀取引擎掛掉**不自動 fallback**，手動改設定重啟（簡單優先）。

### 5. Manticore 接法：SQL（9306），不用 HTTP JSON

- 直接用現有的 `go-sql-driver/mysql`，不用多加依賴；Manticore 的 SQL 也是功能最完整的介面。
- 用獨立的 `*sql.DB`，**跟 MySQL 的 `xorm`／`dbresolver` 分開**，不能混用連線池。
- 寫入也要加 `IsProduction` 保護（本機會跑排程，避免本機寫進 prod Manticore，同 ES 的教訓）。

### 6. 表結構慣例

| 欄位 | 型別 | 用途 |
|---|---|---|
| `id` | bigint | **Manticore 的 id 只能是整數**。有整數主鍵就直接用（AV 影片用 `vid`）；只有字串 ID 的領域用 `fnv64(doc_key) & 0x7FFF…`（取正數），碰撞機率可忽略 |
| `doc_key` | string attribute | 只有字串 ID 的領域才需要，Get／Delete 用它反查 |
| `src` | text，**只存不建索引** | 完整原始文件 JSON，等同 ES `_source`；放 docstore（磁碟）**不要放 json attribute**，否則整份會進 RAM |
| 全文欄位 | text indexed | 例如 title |
| 篩選／排序欄位 | uint／timestamp／string／multi64 attribute | 例如 `vod_ts`、`is_orphan` |

中文分詞：`charset_table='non_cjk,cjk'`＋`ngram_len='1'`＋`ngram_chars='cjk'`（平假名、片假名也算 cjk）。ES cjk analyzer 是 bigram，Manticore 是 unigram 加片語比對，召回率會偏高；差異交給影子比對來判斷。

### 7. 字串陣列：雜湊成整數 MVA＋字典表

Manticore 的多值屬性（MVA）只能放整數，沒有字串陣列。AV 影片的 tags／makers／series／actresses／directors／labels 都是字串陣列，而且同時要**精準篩選**、**分組統計（facets）**、**子字串建議**三種用法。做法：

- 每個值算 `fnv64(kind + "\x00" + value)` 當 term id，存進對應的 `multi64` 欄位（例如 `tag_ids`）。
  - 精準篩選：`ANY(tag_ids) = <id>`；any_tag 聯集：`ANY(tag_ids) IN (...)`。
  - facets：一次查詢加多個 `FACET tag_ids`、`FACET maker_ids`…，回傳的是 term id。
- 另建字典表 `av_video_terms(id, kind, value)`，寫入影片時順便 `REPLACE` 這部片的 term。雜湊 id 是固定的，所以重複寫入不會出問題，也不需要額外的流水號服務。
  - facets／建議回傳 term id 後，到字典表反查成文字（反查結果可以放 Redis，跟現在的建議快取一起）。
  - 建議（suggest）：先在字典表用子字串找出候選 term id，再對影片表 `FACET` 統計，數量為 0 的自然不會出現。
- 字典表**不刪除**舊的 term：數量為 0 就不會出現在結果裡，留著不影響正確性。

> 這是 Manticore 處理字串標籤的標準做法，但 FACET 對 multi64 的分組行為、字典表子字串查詢的效能，要在 PoC 實測。

### 8. ES 功能對照

| ES | Manticore | 狀態 |
|---|---|---|
| bool must／filter、term、terms、range | `WHERE` | ✅ |
| `.keyword` 精準比對（單值） | string attribute `=`／`IN` | ✅ |
| `.keyword` 精準比對（字串陣列） | 雜湊 multi64＋`ANY()`（見第 7 點） | ⚠️ PoC |
| terms aggs（facets、建議） | `FACET <multi64>`＋字典表反查 | ⚠️ PoC |
| wildcard `*關鍵字*`（關鍵字部分比對） | 全文欄位：中日文靠 unigram 片語，英數靠 `min_infix_len=2`＋`dict=keywords` | ⚠️ PoC |
| function_score random_score | `ORDER BY RAND()` | ✅ |
| Mget | `WHERE id IN (...)` | ✅ |
| composite aggs＋sum／min／max | `GROUP BY`＋`SUM()`／`MIN()`／`MAX()` | ✅ |
| collapse＋cardinality | `GROUP BY`＋`WITHIN GROUP ORDER BY`、`COUNT(DISTINCT)` | ✅ |
| search_after | 新版有原生 scroll；不行就用 keyset（`WHERE`） | ⚠️ PoC |
| track_total_hits | `SHOW META` 的 `total_found` | ✅ |
| 深分頁 | 預設 `max_matches=1000`，要加 `OPTION max_matches` | ⚠️ 要注意 |
| Update partial | attribute 可直接 `UPDATE`；全文欄位要整筆 `REPLACE` | ✅（AV 用整筆 REPLACE，見下） |
| UpdateByQuery＋painless | `UPDATE t SET is_orphan=1 WHERE id IN (...)` | ✅ 比 ES 簡單 |
| DeleteByQuery | `DELETE FROM t WHERE ...` | ✅ |
| refresh=wait_for | RT table commit 後立即可查 | ✅ |
| 索引 alias（換 schema 不停機） | 用 distributed table 指向實體表 | ⚠️ PoC |
| 列出索引（nccc） | `SHOW TABLES LIKE 'nccc_%'` | ✅ |

## AV 影片試點：詳細設計

### 讀寫路徑盤點（全部要經過 `VideoIndex`）

| 檔案 | 用途 | 介面方法 |
|---|---|---|
| `service/av/search.go` `VideoSearch` | 列表搜尋（分頁、隨機排序） | `Search` |
| `service/av/video_facets.go` | 篩選面板的 tags／makers／series／actresses 統計 | `Facets` |
| `service/av/video_suggest.go` | 欄位值建議（wildcard＋terms include） | `Suggest` |
| `service/av/video_submission.go` | 上稿時檢查新填的值是否已存在 | `ExistingValues` |
| `service/av/video_store.go` | 依 vid 批次取原始文件（Mget） | `Get` |
| `service/av/actress_topic_stats.go` | 各女優的影片數、最早／最晚日期（composite aggs） | `StatsByActress` |
| `service/av/actress_alias_sync.go` | 別名同步時查影片 | `Search`（或專用方法，實作時確認） |
| `service/av/video_orphan_delisted.go` | 找出下架片並標記 orphan | `ScanForOrphans`＋`MarkOrphan` |
| `service/av/video_sync.go` | 每日同步：Index＋Update | `Upsert` |
| 影片修改審核核准 | 套用覆寫後寫回 | `Upsert` |

### 介面

P0 實際定案的介面（`repository/av/video_index.go`）：

```go
type VideoIndex interface {
	Search(ctx context.Context, q av.VideoIndexQuery) (search.Page[av.RawVideo], error)
	Facets(ctx context.Context, q av.VideoIndexQuery) (av.VideoFacets, error)
	DateStats(ctx context.Context, q av.VideoIndexQuery) (av.VideoStats, error)
	StatsByActress(ctx context.Context, f av.VideoStatsFilter, withDates bool) ([]av.VideoActressStats, error)
	Terms(ctx context.Context, field string, size int, contains ...string) ([]av.VideoFacetBucket, error)
	ExistingTerms(ctx context.Context, field string, values []string) (map[string]bool, error)
	Sources(ctx context.Context, vids []int) (map[int]map[string]any, error)
	Index(ctx context.Context, vid int, doc any, waitVisible bool) error
	MarkOrphan(ctx context.Context, vids []int) error
	NextDelistedVids(ctx context.Context, size int) ([]int, error)
}
```

- `VideoIndexQuery`＝`VideoQueryRequest`＋**已解析的女優條件**（`VideoActressFilter{Name, OwnIDs, ClaimedIDs}`）。同名女優區分要查 MySQL，所以由 service 先解析好，adapter 只負責翻成自己的語法。
- `Terms` 一個方法涵蓋建議（1 個子字串）、別名名單（「（」或「(」）、類型標籤（不限）三種用法。
- `Sources`／`Index` 用 `map[string]any`：核准影片修改時要整份寫回，不能弄丟 `RawVideo` 沒定義的欄位。
- `NextDelistedVids` 是一次性回補工具用的（判斷依據是 logstash 的 `@timestamp`），Manticore 版可以直接回空。

### `av_videos` 表

```sql
CREATE TABLE av_videos (
  title        text,          -- 關鍵字：標題片語比對
  facet_text   text,          -- actresses／series／makers／directors／labels／tags 串接，供關鍵字子字串比對
  src          text stored,   -- 只存不建索引（PoC 確認語法），完整 RawVideo JSON
  no_lc        string,        -- 番號小寫：取代現在 no.keyword 的大寫／原樣／小寫三次比對
  maker_no_lc  string,
  vod_ts       timestamp,
  release_ts   timestamp,     -- 匯出時從 publish_date／pulish_date（舊資料錯字）正規化，先存不用
  is_orphan    bool,
  tag_ids multi64, maker_ids multi64, series_ids multi64,
  actress_ids multi64,        -- 出演者名字的雜湊
  dmm_actress_ids multi64,    -- RawVideo.ActressIDs（同名女優區分）的雜湊
  director_ids multi64, label_ids multi64
) charset_table='non_cjk,cjk' ngram_len='1' ngram_chars='cjk' min_infix_len='2' dict='keywords';
```

- `id` 直接用 `vid`（ES 現在的文件 ID 就是 `strconv.Itoa(vid)`），不用雜湊。
- 舊資料的 `directors`／`series` 是 `[]interface{}`，`publish_date` 型別也不固定：**寫入 Manticore 時一律正規化成字串**，`src` 保留原樣，讀回來的 `RawVideo` 跟現在一致。
- `facet_text` 串接多個值，可能誤中跨值邊界的字串（例如前一個值的結尾接上下一個值的開頭）。機率低，交給影子比對觀察，真的有問題再改用每個值之間插入不會出現在資料中的分隔 token。

### 照實際行為搬，不照字面搬

- **日期條件**：`publish_date`／`pulish_date` 被 `SetQuery(..., false)` 放進 `should`。ES 的 bool 只要有 `must`，`should` 就**不會過濾**，只影響分數，所以實際上只有 `vod_date` 在篩選。Manticore 版只篩 `vod_ts`。
- **番號**：ES 要比對三次（原樣、大寫、小寫），Manticore 寫入時就存小寫，查詢時轉小寫比對一次就好。
- **關鍵字**：`title` 用片語比對，其他欄位用子字串比對。實作時要確認「春咲」找得到「春咲あずみ」、「トコ」找得到「トコダケ」、「春咲」**不會**找到「思春期.com」（這三個是現有程式碼註解裡記錄過的案例，直接拿來當驗收）。

### 回填（ES → Manticore）

`-cmd search-backfill -domain=av_video -from=es [-after=<vid>] [-limit=<筆數>]`

- 用 search_after 依 `vid` 排序掃完 ES（只會拿到 59.9 萬筆有效文件，已刪除的 12.9 萬筆不會跟著搬），每批 1000 筆 `REPLACE` 進 `av_videos`，同時寫字典表。
- 冪等、可用 `-after` 接續；回填期間雙寫已經開著也沒關係，同一個 vid 最後寫入的一定是最新的資料。
- 順序：**先開雙寫，再跑回填**。如果先回填再開雙寫，中間那段時間的更新會漏掉。

### 驗收

**本機（P1，小量樣本，例如 `-limit=20000`）**

1. 回填筆數跟 `-limit` 一致，`SELECT COUNT(*)` 對得上。
2. 抽 100 個 vid，比對兩邊 `Get` 回來的 `RawVideo` 完全一樣。
3. 上面三個關鍵字案例的結果正確（樣本裡要包含這些片，必要時用 `-after` 指定範圍，或另外補寫幾筆測試資料）。
4. 第 8 點對照表裡標 ⚠️ PoC 的語法都能跑，行為符合預期。
5. 同一組查詢條件，在樣本範圍內比對 ES 和 Manticore 的結果（ES 端加上 vid 範圍限制，讓兩邊的資料範圍相同）。
6. 量測樣本的磁碟與 RSS，等比例推估 60 萬筆的大小（只是參考值）。

**prod（P2，主機裝好之後）**

7. 全量回填後，ES `_count` 跟 Manticore `SELECT COUNT(*)` 相同。
8. 影子比對跑一週：`total` 差異和前 10 筆交集比例落在可接受範圍（數字等看到 log 再一起訂）。
9. 實測磁碟與 RSS，修正第 6 點的推估，決定搜尋主機規格。

### 容量估算（本機樣本推估，prod 實測修正）

- 磁碟：`src` 壓縮後估 300～500MB，加上全文索引與 infix 字典，AV 整張表估 **1GB 以內**。
- 記憶體：屬性（時間戳、bool、multi64）每筆約 150～200 bytes，60 萬筆約 100MB；加上字典和快取，估 **300～500MB**。
- 其他領域合計不到 400MB。**整體用 2GB 的機器應該夠**；如果 AV 表實測超過 1GB RSS，就改成 4GB。

## 分階段

| 階段 | 內容 | 完成條件 |
|---|---|---|
| P0 ✅ | `VideoIndex` 介面＋ES adapter（`repository/av/video_index*.go`）、`repository/search.Page`；AV 影片的 10 種讀寫全部改走介面；controller／MCP 改用 `Page.Total` | 行為和 API 回應完全不變；**可以直接部署**，不需要 Manticore（驗證結果見下方「P0 實作紀錄」） |
| P1 | **AV 影片 Manticore adapter**、組合層（雙寫／影子比對）、`SEARCH_ENGINE_AV_VIDEO` 等設定、Manticore client（沒設 DSN 就不連線）、`av_videos`／`av_video_terms` 建表指令、回填指令（含 `-limit`）；固定本機 Manticore 版本 | 本機驗收 1～6 通過。可以併進 main，但 prod 維持 `es` |
| ⏸ | **等 prod 的 Manticore 主機裝好** | — |
| P2 | prod 開 `es+manticore` → 全量回填 → 影子比對一週 → 切 `manticore+es` | prod 驗收 7～9 通過；本機沒測出來的效能問題在這一步修 |
| P3 | 其他領域照同一套流程：nekomaid、taipower、av 女優、storyteller、galgame（只寫） | 各自通過影子比對 |
| P4 | nccc：動態欄位 → 一個資料集一張表，篩選欄位放 json attribute，全文欄位統一合成一個 `body` | 同上 |
| P5 | 全部切成 `manticore`，觀察期後移除 ES adapter、`go-elasticsearch`、`ES_DSN`、`service/search`、`model/entity/search.go` | Linode 可以砍 |

## P0 實作紀錄（2026-11-06）

- 範圍比原規格小：組合層、影子比對、Manticore client、`SEARCH_ENGINE_*` 設定都移到 P1。P0 只有 ES 一種實作，先加這些會變成沒有人用的程式碼。
- 搬移後 service 端少了約 530 行；ES 的查詢組裝集中在 `repository/av/video_index_es_query.go`，共用的 ES 小工具（`Raw`、`TermsAgg`、跳脫器）放在 `service/search/raw.go`，女優後台的出生地統計也改用它。
- **唯一的行為差異**：詳細頁「同步資料」確定失敗時標 orphan，原本是逐筆 `Update`，現在跟一次性下架工具一樣用 `update_by_query` 整批標。結果相同，但如果文件已被同時覆寫，會算成衝突而不是失敗。
- 驗證方式：用 main 編一份舊版在另一個 port 跑，新舊版打同一組本機 DB／prod ES 比對回應。
  - 搜尋＋facets 24 組條件（關鍵字三個案例、標籤交集／聯集、女優名字、xcity_id／manual_id、番號大小寫、各種日期、組合條件）回應 JSON 完全相同；隨機排序比對總數相同。
  - 排程才會用到的方法（類型標籤、別名名單、建議、日期統計、類型分組統計、全部分組統計、Mget、查重、下架掃描）用臨時測試把舊版的 ES 查詢原樣送出，結果一致。
  - **寫入（`Index`、`MarkOrphan`）沒有實測**：本機寫 `dmmvideos` 會被 `videoWritesAllowed` 擋下，程式碼是原封搬移。

## User stories

- 維護者：改一行 env 就能把單一領域切到 Manticore，出事改回來就恢復，不用重新部署程式。
- 維護者：從 log 看得到兩個引擎對同一個查詢的結果差多少，再決定要不要切。
- 使用者：切換過程中搜尋結果、分頁、總數、篩選面板的 API 格式都不變。

## 常見失敗與應對

| 狀況 | 應對 |
|---|---|
| prod 還沒裝 Manticore，程式碼已部署 | 預設 `es`、沒設 DSN 不連線，行為不變 |
| 設定含 `manticore` 但沒設 DSN | 啟動時直接報錯 |
| 本機回填拖垮 prod ES | 回填指令帶 `-limit`；本機只抽小量樣本 |
| 本機測過，prod 卻出錯（版本差異、資料量） | 本機和 prod 用同一版 Manticore；效能問題只能在 P2 發現，所以 P2 先維持 `es+manticore`，確認沒問題才切讀取 |
| Manticore 掛掉（雙寫期間） | 次要寫入只記 warn；恢復後重跑回填（冪等） |
| 讀取引擎掛掉 | 手動改 `SEARCH_ENGINE_*` 重啟；不做自動 fallback |
| 影子比對拖慢 API | 非同步＋500ms timeout＋取樣率；量大時把 `SEARCH_SHADOW_RATE` 調成 0 |
| 本機寫進 prod Manticore | 寫入路徑加 `IsProduction` 保護＋`MANTICORE_TABLE_PREFIX` |
| 回填中途中斷 | 用 `-after=<最後的 vid>` 接著跑 |
| 回填和雙寫同時寫同一部片 | 都是整筆 REPLACE，結果以最後寫入為準；每日同步本來就會再寫一次 |
| 全文欄位要改 schema | 建新表 → 回填 → distributed table 切到新表（PoC 驗證） |
| 雜湊碰撞（字典表） | 寫字典表時如果同一個 id 對到不同的 `kind`／`value`，記 error（機率極低，只做偵測） |
| 深分頁超過 `max_matches` | adapter 依 offset＋limit 自動帶 `OPTION max_matches` |
| 搜尋主機記憶體不夠 | 全文 `src` 放 docstore；P2 量測完再決定主機大小 |

## 影響檔案（P0～P2，只限 AV 影片）

- P0 已完成：`model/entity/opendata/av/video_index.go`、`repository/search/page.go`、`repository/av/video_index{,_es,_es_query}.go`、`service/search/raw.go`；改了 `service/av` 的 12 支檔案、`controller/opendata/av.go`、`service/mcp/av_tools.go`
- P1 新增：`service/client/manticore.go`、`repository/av/video_index_manticore.go`、組合層（雙寫／影子比對）、`cmd` 的建表與回填指令、`config` 新增 `SEARCH_ENGINE_AV_VIDEO`／`SEARCH_SHADOW_RATE`／`MANTICORE_DSN`／`MANTICORE_TABLE_PREFIX`
- P1 修改：`repository/av/video_index.go` 的 `NewVideoIndex`（依設定挑實作）、`main.go`（有設 DSN 才初始化 Manticore client）、`docker-compose.yml`（固定 Manticore 版本）
- 測試：依 AGENTS，Manticore adapter 的 SQL 組裝函式附 table test（三個關鍵字案例也寫進去）

## 待確認

1. `av_videos` 的 `src` 要存完整 `RawVideo`，還是只存列表和詳細頁實際用到的欄位？存完整的比較保險，也方便比對；只存需要的欄位可以省一點磁碟。（建議存完整的。）
2. 驗收 4 的門檻要不要先訂？還是等第一週的 log 出來再一起看？

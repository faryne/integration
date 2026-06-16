我目前要實作一個類似 erogetrailers 的網站，目前規劃的工作項目如下：

## 建立資料表
我會建立 `eroge_brands`：
- brand name：遊戲品牌
- youtube channel id: might be started in `UC......`
- avatar: fetched from youtube
- other youtube channel info, saved in json format 
除了 brand name 和 youtube channel id 由我透過系統/手動填入外，其餘欄位透過你使用 youtube sdk 抓取

接著建立 `eroge_videos`
- channelId: relative to `eroge_brands`.id
- video id from youtube
- video title 
- tags, saved in json's array format if exists
- thumb url
- description
- video published at
- other youtube video info, save in json format 


## 建立資料爬蟲
第一個爬蟲會根據 `eroge_brands` 開始爬取資料更新回 `eroge_brands`，每週更新一次
第二個爬蟲會根據 `eroge_brands` 開始爬取該頻道下標題中可能含有以下字眼的影片並存入 DB 以及進 ElasticSearch （索引使用 `galgame_videos`）
- OPムービー
- オープニングムービー
- OP
- オープニング
- プロモーションムービー
- PV

由於頻道數可能會很多，使用 youtube sdk 時應考慮 sdk credit limit，avoid banned

## API
會需要兩支 API

- 列出品牌 / 搜尋品牌
- 列出所有 / 品牌下影片 / 搜尋影片

路由使用：
/galgame/:brand?/videoId?[keyword=...&published_at_in_range]

## 開始串接前端
路由使用：`/galgame` 開頭， navigation 放在`大人的喜好`內

主頁（A）列出最新抓到的影片，點擊影片後（B）則使用 `VideoViewer` 呈現 youtube 影片播放介面。
另外會有品牌頁（Ｃ）列出該品牌已發佈影片

A、B 及 C 都需要擺放麵包屑，格式：
- `首頁`
- `首頁 > [品牌名稱]`
- `首頁 > [品牌名稱] > 影片標題`


# 問題
- 前端路由的 `/galgame/1` 感覺不大好，可能會被爬蟲做流水號爬取。改成 `/galgame/[加密id]-[brandname]`
- 首頁不列出品牌列表。新增一個 `品牌頁列表`，使用各品牌在 youtube 的 avatar 呈現
- 影片卡加入品牌名稱 chip，在列表時方便識別
- 影片頁中的影片內容有兩份相同內容。

# 最佳化
- 影片頁的介紹 / 品牌頁介紹區域如果有網址就建立連結
- 品牌頁介紹 / 影片頁介紹區塊如果過長則先設定收縮，使用者點擊後再展開
- 品牌頁中的訂閱數 / 影片數 / 觀看數移除
- 品牌列表頁使用分頁展示
- 首頁使用 `Tab` 分別呈現 `所有影片` 及 `最近一天內上檔影片` 

# 最佳化
- `品牌列表` 放進 tab，在 `最近一天內上檔影片` 右側

# 新功能追加/最佳化
- 影片/品牌搜尋放到工具列右上方
- 整合已實作的 firebase login 為之後實作加入頻道/影片為最愛列表做準備
- 實作加入頻道/影片為最愛功能（透過在頻道/影片標題旁加上星號達成。下次載入該頻道時需要載入其加入最愛狀態。）
- 影片頁加入 `上一則` `下一則` 影片 button，用於提供使用觀看該品牌前一則/後一則影片使用

# 最佳化
- 影片卡中顯示影片影片長度
- 品牌頁的加入最愛改放置在介紹區塊中，youtube button 的左手邊，移除星號。color 不用 primary，可能需要客製比較醒眼的顏色
- VideoViewer 下方增加一個工具列（此工具列不是依附在 VideoViewer 下），影片頁的加入最愛改放置到這個工具列
- 【此功能需登入才能使用】影片頁加上「喜歡」/「不喜歡」 button，一樣放在前述的工具列內，與「加入最愛」同一列。在 `eroge_videos` 加入這兩個欄位，每當按下後就在對應欄位加一。另外新增一個資料表記錄使用者按 like / dislike / cancel like / cancel dislike 的時間點與動作，並對應到影片頁的狀態。注意：「喜歡」「不喜歡」按鍵為互斥，按了「喜歡」後不允許再按「不喜歡」，反之亦然（除非按了 cancel）。
- 列表頁的影片卡以及影片頁中相關影片的影片卡基本上都會有相同邏輯（包含加入最愛、影片標題、時間長度），差別只在於顯示的大小而已。抽成共通元件，帶入一個參數（值大概是 summary / simple）去區分怎麼呈現就好。這個影片卡元件視使用狀況可能（很大機率）會提升為共用元件，因此可以順便考慮 decoupling。
- 品牌頁使用 `tab` 顯示：一個是所有影片。另一個是最新上檔影片，比照首頁中「最新上檔影片」
- 收藏品牌中列出該品牌的最新上檔影片數。如果大於 0 ，則進入品牌頁的最新上檔影片。反之 disabled。
- footer 加入警語與版權宣告等字眼。使用共用元件 `BilingualDisclaimer` 
- 考慮到資料更新並沒有這麼頻繁，搜尋結果等可以先做一個小時的 cache。新上檔影片可以不用做 cache
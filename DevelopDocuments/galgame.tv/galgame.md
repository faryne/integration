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

# 
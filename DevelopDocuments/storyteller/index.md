# Storyteller
這是一個提供撰寫故事以及 AI 輔助撰寫故事的工具。

使用者可以依序執行以下事項：
- 建立故事專案
- 提供 API KEY 建立 AI Agent，目前打算串接 Grok，需要保留可以串接其他 AI Agent 的能力。
- 在故事編寫介面開始撰寫故事
- 在有需要時呼叫 AI Agent 介面，詢問 AI 特定問題或是由 AI Agent 直接讀取當前完整內容或是根據選取的內容去繼續接著寫下去或是改寫內容。

預計會有以下幾個頁面，路由一律以 `/storyteller` 開頭：
- `/`：首頁，列出所有使用者公開的 `project`，點擊後走到 `/story/[publicId]-[slug]` 進入閱讀介面。
- `需登入` `/my`：首頁，列出目前已建立的故事專案以及 AI Agent 。使用 tab 分別顯示這兩個元素。
- ~~`需登入` `/project`：專案列表（不再使用）~~
- `需登入` `/project/new`：建立新專案，需要讓使用者填 `專案名稱（不可重複）` `專案描述` `專案特殊網址（可不填寫，若不填寫則使用系統隨機產生。中英數皆可，不得使用符號。也必須確保不與其他專案重複）`
- `需登入` `/project/:id`：專案頁面，列出該專案下的所有故事列表。`:id` 不得使用明碼，必須在 table 中建立隨機碼。
- ~~`需登入` `/agent`：AI Agent 列表（不再使用）~~
- `需登入` `/project/:id`：故事專案頁面，列出該專案下的所有故事以及 AI Agent
- `需登入` `/project/:id/story/new`：建立故事頁面，頁面比照編輯頁。在第一次存檔後，路由會轉變成 `/project/:id/story/:storyId`
- `需登入` `/project/:id/story/:storyId`：故事編輯頁，目前已有 `<Editor />` 元件，你可以直接推翻掉或是改寫。但是要確保有以下功能：`文字編輯（使用 markdown）` `預覽` `AI Agent 介面` `編輯歷史`。markdown 編輯區 select 文字時可以出現以下功能：`呼叫 AI Agent 改寫` 等等
- `需登入` `/project/:id/story/:storyId/diff`：故事編輯頁切到 `編輯歷史` tab 時，瀏覽器網址列需更新成這條路由。畫面仍使用故事編輯頁，並在 `編輯歷史` 內列出故事內容版本列表。每個 diff 前面都有一個 `radio`，選擇兩個不同的 diff 內容後可以進入比對頁面。版本列表需提供分頁列。
- `需登入` `/project/:id/story/:storyId/diff/:diffId1/:diffId2`：故事內容的 diff ，比對這兩個版本的差異。包含文字以及標題，使用標準的左右對照，highlight 差異處。
- `/story/[publicId]-[slug]`：故事閱讀首頁，預設顯示該專案的故事的索引。點擊索引下各項目跑到該故事。此為公開頁面。
- `/story/[share_token]`：故事閱讀首頁，預設顯示該專案的故事的索引。點擊索引下各項目跑到該故事。此為不公開頁面。

前述每個頁面都必須加上麵包屑。

## 工作項目
以下列出前後端所需的工作項目，請按照指示在完成後依序在每個項目前打勾確認：

### 前端
- [x] 先行拉出 `首頁` `專案列表` `AI Agent` 列表
- [x] 拉出 `建立專案` `建立 AI Agent` 頁面
- [x] 拉出故事編輯頁
- [x] 拉出新建故事頁面
- [x] `/project/:id/story/new` 和 `/project/:id/story/:storyId` 都新增一個可以輸入標題的 input，故事標題以這個 input 為主
- [x] diff 頁面列表加入 radio 可供選擇，以及 diff 的差異比對頁面。
- [x] 按照 `細部規格` > `AI Agent 畫面` 重新設計 AI Agent
- [x] 修改前端中「首頁」和 `/mine`路由的用途，以及拉出故事頁路由的參考頁面 （`/story` 開頭路由）
- [x] 新增 `storyteller` 專用 layout 並套用
- [x] 新的 `storyteller` layout 必須整合專案已有的 login 功能。
- [x] 實作收藏功能
- [x] 前端增加 user 的維護功能、故事頁加入作者筆名顯示

### 後端資料表
- [x] 按照 `migration 與資料表` 中的內容，產生 `專案` `故事` `故事版本` `代理` 的 migration 以及 model entity
- [x] 處理 `migration 與資料表` 中的內容，處理 `聊天` 相關的資料表
- [x] `project` 資料表增加 `評分人數` 與 `評分總分` ，平均分數由前端計算
- [x] `migration 與資料表` 中的內容，產生 `收藏` 的 migration 以及 model entity
- [x] `migration 與資料表` 中的內容，產生 `使用者` 的 migration 以及 model entity

### 後端 api 
- [x] 新增 `project` 的 CRUD api 
- [x] 新增 `agent` 的 CRUD api
- [x] 新增 `story` 的 CRUD api
- [x] 新增 `favorite` 的 CRUD api
- [x] 新增 `ranking` 操作 api 以及前端的串接
- [x] 新增 `user` 的 CRUD api

### 追加調整
- [x] diff 列表前的 radio 分成左右兩個，左邊的是 diff1 ，右邊是 diff2。同時右邊的 diff2 不能選 diff1 之後更新的。
- [x] 增加故事摘要輸入框。將故事標題/摘要輸入框往上挪取代原本就有的區塊
- [x] `存檔` button 用來儲存包含 `故事標題` `故事摘要` `故事本文`
- [x] `故事內容` 輸入框增加基本的文字樣式 button（如粗/斜/底標、文字置中/左/右）。並把 `使用 AI 改寫` 和 `預覽` button 挪至跟這些文字樣式 button 並排（要分 group） 。
- [x] 在故事頁中的故事內容尾端加上 `上一章 [章節名稱]` `本章 [章節名稱]` `下一章 [章節名稱]` 的 card
- [x] 故事頁需要加入收藏 button 以及評分 button （使用五星制，以半顆星為基本單位）
- [x] 故事頁索引可像抽屜一般收起/展開。另外故事頁索引需考慮到行動裝置調整位置
- [x] review project
- [x] review story
- [x] 確認變更的 migration 並產生新檔案

### Review 與補強
- [x] review `細部規格` > `關於 storyteller layout`
- [x] `storyteller` layout header 增加 `我的收藏` 入口
- [x] `storyteller` layout 登入後右上角顯示使用者名稱與 avatar
- [x] `storyteller` layout footer 改用 `components/commin/IndependentFooter.tsx`，`service_name` 使用 `StoryTeller`
- [x] review `細部規格` > `關於 project`
- [x] `/mine` 的 project card 增加 `編輯` button
- [x] 實作 `project` 編輯畫面，並串接既有 update project API
- [x] `/mine` 的 project card 增加 `刪除` button
- [x] 實作刪除確認 dialog，使用者必須輸入 project 名稱後才可刪除
- [x] 刪除確認 dialog 設計成可共用元件
- [x] 串接 delete project API，刪除成功後更新 project list
- [x] project card 顯示總評分人數與平均分
- [x] review public project / mine project / reader 頁面的 API fallback 行為，避免登入或空資料時顯示不一致
- [x] review project / agent / story CRUD API 的錯誤處理與前端錯誤訊息

## 細部規格

### AI Agent 畫面
故事編輯頁的 AI Agent 視窗設計如下：
- 基本上還是個一般的對話/輸入框
- 抬頭第一行放置 `AI Agent` 以及可選擇 Agent 的下拉選單。第二行小字則顯示該 Agent 特性 / 用途以及其他相關資訊
- 增加 `new chat` / `history` button，作為建立新聊天或是列出過去聊天
- 下方會是使用者輸入自己的需求，使用者可輸入 markdown 在對話內容可以被處理成 rich-text
- <del>最下方可以選擇使用的 AI Agent 及相關資訊</del>

請根據這種感覺先設計出 mockup

### 關於 storyteller layout
- Header 增加一個 `我的收藏`
- 登入後 Header 右上角顯示使用者名稱以及 avatar
- footer 使用 `components/commin/IndependentFooter.tsx`。`service_name` 使用 StoryTeller

### 關於 project 
- 需要實作 `project` 的編輯畫面，編輯 button 放在 `/mine` 下顯示 `project`時。
- 刪除 `project` 的 button 也放在 `/mine` 下顯示 `project`時。按下後會出現一個確認 dialog ，使用者必須輸入該 `project` 名稱，刪除 button 才會亮起來。此 dialog 可作為共用元件
- 顯示總評分人數以及平均分在 project card 內
- project card 內一定要有的元素： `公開屬性` `故事章數` `總評分數` `平均分數` `故事總字數` `標題` `摘要`

### 關於 story 
- story 內容在存檔時，要存一份進 story version


### migration 與資料表
所有資料表名稱皆以 `storyteller_` 開頭。
此外，若未特別提及所有資料表都實作 soft delete。

#### 專案（project）
專案資表紀錄此專案的`名稱` `專案特殊網址` `專案描述` `user_id` 以及`狀態`。

其中狀態分為：
- `已公開`：會產生公開網址，任何人都可以閱讀
- `與親友分享`：會產生一個`專用頁面網址`，只有拿到這個公開網址才能閱讀。
- `完全不公開`：任何人即使拿到/知道閱讀網址規則也無法閱讀

#### 代理（agent）
記錄每個 AI Agent 的相關資訊，至少包含：
- Agent 名稱：用來識別該 agent 用途
- AI 供應商：目前限定 `Grok` 但可能會增加其他
- 模型名稱：會由後端呼叫 AI 供應商取得模型列表後，由使用者選擇後填入
- API KEY
- Agent 預設 prompt ：這部分會在初始化 Agent 時送給 AI 供應商。
- is_deleted：做軟刪除使用
- user_id 

### 故事（story）
記錄故事與專案的連結，以及故事內容的最新版本，至少會有以下欄位：
- 故事標題/章節名稱
- 故事摘要
- sort：用以表示該故事的順序，故事列表應該使用這個欄位排序
- 故事最新內容
- project_id
- 字數統計


### 故事版本（story version）
記錄版本與故事的連結，用以產生每個版本的差距，至少要有：
- story_id
- 該版本原始內容
- 該版本內文字數統計

### 聊天（story chat)
與故事綁定，記錄每個聊天室的 metadata 等資訊

### 聊天訊息（story chat message）
記錄聊天室

### 收藏（project favorite）
`刪除此表` 記錄 user_id 與 project_id 等欄位

### 專案評分（project favorite ranking）
記錄每個使用給作品的評分。原則上使用者可以隨時變更評分。因此 project 的評分相關欄位拔除。改使用這個資料表即時計算。
也透過這張表得知使用者是不是有給指定作品評分過。

另外考慮與收藏功能部分重複，因此將收藏也整併到本表

基本記錄以下欄位
- user_id
- project_id
- ranking
- is_favorite

### 使用者資訊（user）
存放使用者在 `storyteller` 專案中的專用資料
- user_id
- pen name：筆名
- 自我介紹
- use_default_avatar：0 / 1，1 的話直接使用 `user` 的 avatar
- avatar_url：use_default_avatar=0 時才能讓使用者上傳自己的 avatar 到本專案 s3，path 為 `storyteller/avatar/[userId]-[hashId].png`

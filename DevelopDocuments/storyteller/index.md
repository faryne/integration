# Storyteller
這是一個提供撰寫故事以及 AI 輔助撰寫故事的工具。

使用者可以依序執行以下事項：
- 建立故事專案
- 提供 API KEY 建立 AI Agent，目前打算串接 Grok，需要保留可以串接其他 AI Agent 的能力。
- 在故事編寫介面開始撰寫故事
- 在有需要時呼叫 AI Agent 介面，詢問 AI 特定問題或是由 AI Agent 直接讀取當前完整內容或是根據選取的內容去繼續接著寫下去或是改寫內容。

預計會有以下幾個頁面，路由一律以 `/storyteller` 開頭：
- `/`：首頁，列出目前已建立的故事專案以及 AI Agent 。使用 tab 分別顯示這兩個元素。
- `/project`：專案列表
- `/project/new`：建立新專案，需要讓使用者填 `專案名稱（不可重複）` `專案描述` `專案特殊網址（可不填寫，若不填寫則使用系統隨機產生。中英數皆可，不得使用符號。也必須確保不與其他專案重複）`
- `/project/:id`：專案頁面，列出該專案下的所有故事列表。`:id` 不得使用明碼，必須在 table 中建立隨機碼。
- `/agent`：AI Agent 列表
- `/project/:id`：故事專案頁面，列出該專案下的所有故事以及 AI Agent
- `/project/:id/story/new`：建立故事頁面，頁面比照編輯頁。在第一次存檔後，路由會轉變成 `/project/:id/story/:storyId`
- `/project/:id/story/:storyId`：故事編輯頁，目前已有 `<Editor />` 元件，你可以直接推翻掉或是改寫。但是要確保有以下功能：`文字編輯（使用 markdown）` `預覽` `AI Agent 介面` `編輯歷史`。markdown 編輯區 select 文字時可以出現以下功能：`呼叫 AI Agent 改寫` 等等
- `/project/:id/story/:storyId/diff`：故事編輯頁切到 `編輯歷史` tab 時，瀏覽器網址列需更新成這條路由。畫面仍使用故事編輯頁，並在 `編輯歷史` 內列出故事內容版本列表。每個 diff 前面都有一個 `radio`，選擇兩個不同的 diff 內容後可以進入比對頁面。版本列表需提供分頁列。
- `/project/:id/story/:storyId/diff/:diffId1/:diffId2`：故事內容的 diff ，比對這兩個版本的差異。包含文字以及標題，使用標準的左右對照，highlight 差異處。

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

### 追加調整
- [x] diff 列表前的 radio 分成左右兩個，左邊的是 diff1 ，右邊是 diff2。同時右邊的 diff2 不能選 diff1 之後更新的。
- [x] 增加故事摘要輸入框。將故事標題/摘要輸入框往上挪取代原本就有的區塊
- [x] `存檔` button 用來儲存包含 `故事標題` `故事摘要` `故事本文`
- [x] `故事內容` 輸入框增加基本的文字樣式 button（如粗/斜/底標、文字置中/左/右）。並把 `使用 AI 改寫` 和 `預覽` button 挪至跟這些文字樣式 button 並排（要分 group） 。

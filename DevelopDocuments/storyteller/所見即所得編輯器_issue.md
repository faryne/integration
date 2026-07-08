# issue 
- [x] 閱讀頁加入書籤後，文字摘要會顯示 `markerId` 的前幾碼：建議移除「行數」的顯示，並且摘要部分顯示除了 `markerId` 以外的內容。
  - 根因：`line_preview` 是後端用 SQL（`SUBSTRING_INDEX`）直接抓出該行原始內容，marker 遷移後這一行變成 `⟦markerId ...⟧內容⟦/markerId⟧`，前端再直接 slice 前 10 個字，所以看到的是 markerId 開頭。
  - 修法：`service/storyteller/storyteller.go` 的 `ProjectStoryBookmarks` 在拿到 SQL 結果後，用新增的 `stripBookmarkLineMarker()`（跟前端 `stripMarkerForDiffLine` 邏輯一致）清掉 marker/align/comment/commentColor 屬性跟標題前綴，只留可讀文字。
  - `Reader.tsx` 書籤列表拿掉「第 X 行」的顯示，只留清理過的文字摘要（空段落時顯示「（空白段落）」）。

- [x] 編輯歷史的字數統計異常暴增（例如 12,029 → 55,457，但兩版內容其實沒改動）
  - 根因：儲存版本時後端 `service/storyteller/storyteller.go` 的 `wordCount(content)` 是直接對「原始 content 去空白後算字元數」，marker 遷移後每個段落都多了 `⟦markerId align="..." comment="..." commentColor="..."⟧...⟦/markerId⟧` 這種系統語法（光 markerId 就兩個 36 碼 UUID），全部被當成「字數」灌水進去。前端編輯器本身的即時字數（`StoryEditor.tsx`／`LoreEditor.tsx`）在這次遷移時已經改用 `parseMarkdownToParagraphs` 抓乾淨文字計算過，但後端存檔用的 `wordCount()` 沒有同步修正，造成「編輯中看到的字數」跟「存檔後版本列表看到的字數」不一致。
  - 修法：`wordCount()` 逐行處理：先拿掉標題前綴（`#` 到 `######`），再拿掉 marker 包裹（align/comment/commentColor 屬性連同 marker id 一起丟棄，只留段落可讀內容），最後拿掉行內樣式 delimiter（`**`／`__`／`++`／`*`／`~`／`^`），只算真正會顯示給讀者看的文字，邏輯對應前端 `parseMarkdownToParagraphs` 取 runs 文字的公式，確保兩邊算出來的字數一致。
  - **待確認**：這個修法只影響「之後新存的版本」。已經存在 DB 裡、字數已經灌水的舊版本（例如螢幕截圖裡那個 55,457 字的版本）不會自動改過來，需要另外決定要不要寫一個一次性的 script 把既有 `story_version`／`lore_version`／`story`／`lore` 的 `word_count` 全部重新計算一次。這屬於會動到既有資料的操作，先不擅自執行，等你確認要不要做、什麼時候做。
  - 修這條時順便發現並修掉一個相關的既有 bug：上一條書籤修復裡新增的 `storyBookmarkMarkerPattern`（Go 版 marker 正規表示式）只寫了 `align`／`comment` 兩個屬性，忘記加上同一批工作新增的 `commentColor`——只要段落有設定 `commentColor`，正規表示式就完全比對不上，導致那則書籤的預覽文字還是會漏出整段 marker 語法。已經改成 `storyMarkerPattern`（跟 `splitHeadingAndMarkerContent` 共用），三個屬性都有涵蓋，並用真實 DB 資料（`a8dc4fb6-...` 那筆帶 `commentColor="pink"` 的段落）驗證過可以正確清乾淨。

# 功能追加
- [x] 註解目前全都使用鵝黃色作為底色，希望在編輯/加入註解時可以選用顏色（使用固定幾種偏亮色系即可）
  - 新增 marker 屬性 `commentColor`（`whitelist.ts` 的 `COMMENT_COLOR_VALUES`：yellow／pink／blue／green／purple，預設 yellow），固定順序 align → comment → commentColor，省略時代表預設色（維持舊資料原本看到的黃色）。
  - 加註解／編輯註解的 Dialog 裡加一排色塊選色，`setComment` command 同時帶入顏色；移除註解時 `commentColor` 一併清空；Enter 分割段落時新段落的 `commentColor` 也重置成 null（跟 comment 一樣）。
  - `commentHighlight.ts` 依 `commentColor` 決定套用哪個 CSS class（`wysiwyg-comment-color-{color}`），`StorytellerWysiwygEditor.tsx` 內建 5 色的底色／邊框樣式。只影響編輯區，不影響閱讀頁（註解本來就不會出現在預覽/閱讀端）。

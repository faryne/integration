# issue 
- [x] 閱讀頁加入書籤後，文字摘要會顯示 `markerId` 的前幾碼：建議移除「行數」的顯示，並且摘要部分顯示除了 `markerId` 以外的內容。
  - 根因：`line_preview` 是後端用 SQL（`SUBSTRING_INDEX`）直接抓出該行原始內容，marker 遷移後這一行變成 `⟦markerId ...⟧內容⟦/markerId⟧`，前端再直接 slice 前 10 個字，所以看到的是 markerId 開頭。
  - 修法：`service/storyteller/storyteller.go` 的 `ProjectStoryBookmarks` 在拿到 SQL 結果後，用新增的 `stripBookmarkLineMarker()`（跟前端 `stripMarkerForDiffLine` 邏輯一致）清掉 marker/align/comment/commentColor 屬性跟標題前綴，只留可讀文字。
  - `Reader.tsx` 書籤列表拿掉「第 X 行」的顯示，只留清理過的文字摘要（空段落時顯示「（空白段落）」）。

# 功能追加
- [x] 註解目前全都使用鵝黃色作為底色，希望在編輯/加入註解時可以選用顏色（使用固定幾種偏亮色系即可）
  - 新增 marker 屬性 `commentColor`（`whitelist.ts` 的 `COMMENT_COLOR_VALUES`：yellow／pink／blue／green／purple，預設 yellow），固定順序 align → comment → commentColor，省略時代表預設色（維持舊資料原本看到的黃色）。
  - 加註解／編輯註解的 Dialog 裡加一排色塊選色，`setComment` command 同時帶入顏色；移除註解時 `commentColor` 一併清空；Enter 分割段落時新段落的 `commentColor` 也重置成 null（跟 comment 一樣）。
  - `commentHighlight.ts` 依 `commentColor` 決定套用哪個 CSS class（`wysiwyg-comment-color-{color}`），`StorytellerWysiwygEditor.tsx` 內建 5 色的底色／邊框樣式。只影響編輯區，不影響閱讀頁（註解本來就不會出現在預覽/閱讀端）。

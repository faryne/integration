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

- [x] **加註解改成行內（選取範圍）而不是整個段落**——已實作（2026-07-09，腳注做完後追加）。
  - **緣起**：實作腳注時想到，加註解當初做成段落層級（跟 `align` 共用同一個段落 marker），單純是因為那是這個編輯器最早建的 marker，那時候還沒有行內 marker 機制——但使用者可能只想針對段落裡的一小段文字加註解，不一定是整段。既然腳注/連結/文字顏色都已經證明「行內 marker」機制好用，comment 也比照辦理走行內選字，不再限制只能整段。
  - **實作摘要**：`type="comment"` 加進 `INLINE_MARKER_TYPES`，語法 `⟦comment-<id> comment="跳脫過的註解文字" commentColor="pink"⟧被選取的文字⟦/comment-<id>⟧`（`commentColor` 省略代表預設色 yellow，跟以前段落屬性時代的省略規則一致）。
    - `whitelist.ts`：`MARKER_COMMENT_ATTR`／`MARKER_COMMENT_COLOR_ATTR`／`COMMENT_COLOR_VALUES`／`DEFAULT_COMMENT_COLOR` 這些常數本身不變，只是現在被行內 marker 的 `comment-<id>` 消費，不再出現在段落 marker 上；段落 marker 的固定順序也從「align → comment → commentColor」簡化成只剩 `align`。
    - `parser.ts`：`ParsedParagraph` 移除 `comment`／`commentColor` 欄位；`ParsedRun` 新增 `commentId`／`comment`／`commentColor`（跟 `footnoteId` 同一套「同一則註解橫跨多個 run 時共用同一個 id」的設計）；`MARKER_PATTERN`（段落層級）簡化成只認 `align`；`InlineAttrs`／`parseInlineAttrs`／`applyInlineAttrs` 都加上 comment 相關欄位的解析。
    - `serializer.ts`：`InlineWrapper` 加 `"comment"` kind（`comment`/`commentColor` 兩個屬性，跟 `span` 的 `textColor`/`bgColor` 同樣是「一個 kind 帶兩個屬性」的先例），序列化時放在跟 `footnote` 同一層（最外層，delimiter/span/a 之前）；`serializeParagraph` 移除 comment/commentColor 相關輸出。
    - `inlineCommentMark.ts`（新）：`InlineComment` tiptap Mark，`comment` 屬性的 `renderHTML` 同時讀 `commentColor`（Tiptap 每個屬性的 `renderHTML` 收到的其實是整個 mark 的屬性物件，不是只有自己那一個值，這個技巧沿用來讓一個屬性的 renderHTML 就能算出完整的 class 名稱）。`commentHighlight.ts`（舊的 ProseMirror decoration plugin）直接刪除——高亮邏輯改成純粹由這個 mark 的 `renderHTML` 決定 class，不需要另外維護一個獨立的 decoration extension。
    - `markerParagraph.ts`：移除 `comment`／`commentColor` 段落屬性、`setComment` command（改由 `InlineComment` mark 自己的 `setComment`/`unsetComment` 提供）；Enter 分割段落時原本會手動重置 `comment`/`commentColor` 的兩行也一併移除——行內 mark 不需要特別處理，ProseMirror 預設的分割行為就會正確地讓 mark 留在它原本包住的文字範圍內（跟粗體/顏色/連結/腳注等其他行內 mark 的行為一致）。
    - `StorytellerWysiwygEditor.tsx`：`handleOpenCommentDialog`/`handleConfirmComment`/`handleRemoveComment` 全部改用 `extendMarkRange("comment")` 的 mark-based 流程（跟連結/腳注同一套模式），不再需要「找到持有某個 markerId 的段落」這種段落層級操作；`editorState.hasComment` 改用 `isActive("comment")`；新增 `hasSelection`／`canOpenCommentDialog`——**加註解現在需要真的選取一段文字才能新增**（編輯/移除既有註解則不受此限制，游標落在裡面就能開），沒有選取時工具列按鈕跟右鍵選單項目都會停用並顯示提示；`COMMENT_HIGHLIGHT_SX` 從「段落左側色條」改成「這段文字本身的底色＋底線」（比照螢光筆註解視覺，因為現在是選取範圍而不是整段）。
    - **舊資料相容（重要）**：這是一個會改變序列化格式的異動，2026-07-09 之前存的故事/設定集內容，段落 marker 上還留著舊版的 `comment="..." commentColor="..."` 屬性。如果不處理，新的 `MARKER_PATTERN` 會直接比對失敗、整段退化成純文字，使用者會看到原始 `⟦...⟧` 語法外洩、既有註解也會憑空消失。解法：
      - 前端新增 `LEGACY_PARAGRAPH_COMMENT_PATTERN`（`parser.ts`），偵測到舊格式時把整段內容包一層合成的行內 comment marker（沿用 `parseInline` 既有的行內 marker 解析路徑，不用另外寫一次性遷移腳本），視覺/資料上等同「原本整段都有註解」→「行內註解剛好包住整段文字」，語意無損；下次存檔會自然序列化成新格式，等於原地遷移。
      - 後端 `storyMarkerPattern`（Go）刻意**保留**對舊版 `comment`／`commentColor` 屬性的比對（選配、不擷取值）——Go 這邊本來就只是把 comment 整個丟棄（從來不算進字數/書籤預覽），新舊格式「丟掉就好」的處理完全一樣，繼續比對舊屬性純粹是避免舊段落因為多了這兩個屬性讓整個 marker 比對失敗、退化成把原始語法外洩。
  - **已驗證**：TS round-trip 22 項全過，涵蓋新格式（含跨粗體的註解、預設色省略/還原）跟舊格式相容（含跳脫引號、align 保留、diff-strip 乾淨無 `⟦⟧`外洩、遷移後重新存檔會變成新格式）；Go 測試涵蓋舊格式段落丟棄不算字數、新格式行內 marker 丟棄不算字數、純 `align` 段落正常解析三項全過；`tsc -b`／`eslint`／`prettier`／`go build`／`go vet` 皆乾淨；dev server 對所有異動模組的 HMR/smoke test 全過，無編譯錯誤。同樣**未在瀏覽器實際點過工具列/Dialog/右鍵選單/「沒選字時加註解按鈕會停用」的互動**（環境限制，見腳注那筆的說明），僅資料層／型別層／建置層驗證。

- [x] **讀者可見的「腳注」功能**（像論文腳注或維基百科的參考註解，讀者也會看到，不是編輯限定的「加註解」）——已實作（2026-07-09）。
  - **實作摘要**：沿用文字顏色/連結打好的通用「行內 marker」機制，新增 `type="footnote"`，語法 `⟦footnote-<id> note="跳脫過的腳注內文"⟧被選取的文字⟦/footnote-<id>⟧`。跟連結最大的不同：腳注內文本身還要支援有限的行內樣式（粗體/斜體/底線），且讀者端需要「編號＋上標連結＋尾端腳注清單＋回連結」這一整套額外渲染，不是單純套個 style/href 就結束。
    - **範圍確認**（實作前用 `AskUserQuestion` 跟你確認過三點）：腳注內文只接受粗體/斜體/底線（不含上下標、不能再巢狀顏色/連結/另一個腳注）；編輯區走「簡化版」——跟加註解一樣是反白提示＋hover tooltip＋右鍵選單，不在編輯器內即時顯示編號或尾端預覽；版本 diff 把腳注獨立成一個「腳注」區塊比對（比照閱讀頁把腳注放在故事尾端渲染），不是讓腳注內文跟著本文那一行進入內容 diff。
    - `whitelist.ts`：`INLINE_MARKER_TYPES` 加 `"footnote"`；新增 `MARKER_NOTE_ATTR`／`FOOTNOTE_MARK_NAMES`（`["bold","italic","underline"]`）／`FOOTNOTE_PARSE_DELIMITERS`（從 `PARSE_DELIMITERS` 篩出這三種，刻意不含上下標，避免腳注內文字面上打的 `~`／`^` 被誤判成樣式）。
    - `parser.ts`：`ParsedRun` 加 `footnoteId`（含 `footnote-` 前綴，同一腳注橫跨多個 run 時共用同一個值，供渲染端判斷「連續幾個 run 其實是同一個錨點」）／`footnoteNote`（原始未解析內文）；新增自成一格的 `parseFootnoteNoteRuns()`——限縮版遞迴解析器，只認 `FOOTNOTE_PARSE_DELIMITERS`，不認任何行內 marker（腳注內文不能再巢狀另一個顏色/連結/腳注）；新增 `extractFootnoteNotesForDiff(content)`，依文件順序、依 id 去重，抽出每則腳注的乾淨文字（marks 已剝除），供 diff 頁單獨比對用。
    - `serializer.ts`：`InlineWrapper` 加 `"footnote"` kind，序列化時放在最外層（span／a／delimiter 之前），`note` 屬性一樣走 `escapeMarkerComment` 跳脫。
    - `inlineFootnoteMark.ts`（新）／`footnoteRender.tsx`（新）：`InlineFootnote` tiptap Mark（單一 `note` 屬性，故意不存 id——id 只是序列化時的配對用途）；`renderFootnoteNote()` 共用渲染函式（把限縮版 marks 轉成 `<strong>`/`<em>`/`<u>`），編輯區 hover tooltip 跟閱讀頁腳注清單都呼叫同一份，兩邊格式保證一致。
    - `StorytellerWysiwygEditor.tsx`：比照加註解／連結的既有模式——工具列按鈕＋Dialog（多行 TextField，附一行「只支援 `**`/`*`/`++`」提示）、hover tooltip（新增 `.wysiwyg-has-footnote` 偵測，跟註解的 hover 邏輯並存不衝突）、右鍵選單加「加腳注／編輯腳注／移除腳注」，皆用 `extendMarkRange("footnote")` 讓編輯既有腳注時整個範圍一起被替換。編輯區高亮走點狀底線＋`cursor:help`，刻意跟連結的實線底線區分，避免使用者誤以為腳注也能點擊跳轉。
    - `StorytellerWysiwygMarkdown.tsx`：改成兩輪處理——第一輪掃過全部段落，依文件出現順序給每個不重複的 `footnoteId` 編號（讀者看到 1、2、3...，不是內部亂數 id）；第二輪渲染時，`renderParagraphRuns()` 取代原本單純的逐 run 渲染，偵測「連續 run 共用同一個 footnoteId」的分組，只在整組最後一個 run 後面插入一次上標編號連結（不是每個 run 各插一次），所有段落渲染完後再多渲染一個「腳注」區塊，依編號列出 `renderFootnoteNote()` 渲染過的內文＋一個回內文的反向連結。錨點/回連結的 DOM id 用 `useId()` 前綴＋`footnoteId` 組成，避免同一頁同時渲染兩個實例（例如版本 diff 左右並排）時 id 相撞。
    - 後端 `service/storyteller/storyteller.go`：`storyInlineMarkerPattern` 的 type 清單加 `footnote`；新增 `footnoteOpenPattern`／`extractFootnoteNotes()`（只比對腳注「開頭」標記，抽出 `note` 屬性值，依 id 去重）／`unescapeMarkerAttr()`（Go 這邊第一個屬性值反跳脫函式，之前的 comment／span／href 都只是整段丟棄、沒有真的解析出值）；`stripInlineDelimiters` 一般化成參數化的 `stripDelimitersFrom(text, delimiters)`，讓 `footnoteInlineDelimiters`（`**`／`__`／`++`／`*`，刻意跟前端 `FOOTNOTE_PARSE_DELIMITERS` 對齊、不含 `~`/`^`）可以共用同一套邏輯；新增 `extractFootnoteWordCount()`，加總進 `wordCount()` 總數——使用者要求「腳注內容需要算進故事字數」。
    - 三個 diff 頁（`StoryVersionDiff.tsx`／`StoryDiffCompare.tsx`／`LoreDiffCompare.tsx`）都加一個獨立的「腳注」比對區塊，用 `extractFootnoteNotesForDiff()` 兩側結果各自 `join("\n")` 餵給既有的 `buildCustomLineDiff`；`StoryVersionDiff.tsx`（讀者可見的公開版本比較頁）兩側都沒有腳注時整段不顯示，`StoryDiffCompare.tsx`／`LoreDiffCompare.tsx`（作者用的純文字 diff 頁）沿用既有 `CustomDiffSection` 元件，沒有腳注時該區塊自動顯示「無變更」，不需要額外判斷是否要隱藏。
  - **已驗證**：Node/Vite `ssrLoadModule` round-trip（腳注橫跨粗體/單一腳注/note 含跳脫引號等場景）全過；Go 測試涵蓋 `extractFootnoteNotes`（含跳脫引號還原、同 id 去重）、`extractFootnoteWordCount`、`stripStoryInlineMarkers` 三項全過；`tsc -b`／`eslint`／`prettier`／`go build`／`go vet` 皆乾淨；dev server 對所有異動模組的載入 smoke test（curl 200、無編譯錯誤）全過。同樣**未在瀏覽器實際點過工具列/Dialog/右鍵選單**（環境限制：`preview_start`/`claude-in-chrome` 在 worktree 下會誤連到主 repo，見既有已知限制），僅資料層／型別層／建置層驗證，**Dialog 輸入、hover tooltip 定位、右鍵選單項目、閱讀頁編號與跳轉等 UI 行為建議實際操作時再確認一次**。
  - **修正（2026-07-09，同一天第三輪）**：合併之後使用者發現腳注會出現在每個標題區段的尾端，而不是整篇故事的最尾端。根因：`Reader.tsx` 的 `StoryContentLines` 是「逐行渲染」——每個段落各自是獨立的一個 `<StorytellerWysiwygMarkdown>` 實例（因為每行需要各自掛書籤功能的錨點），而腳注的編號／尾端清單邏輯原本寫在 `StorytellerWysiwygMarkdown` 元件內部、只看自己收到的 `children`，所以每一行都會各自從編號 1 重新算一次、且只要那一行有腳注就會各自渲染一次尾端清單——結果就是腳注清單看起來像是掛在每個段落（含每個標題區段）後面，而不是故事最尾端。
    - 修法：把編號計算邏輯抽成 `parser.ts` 的 `computeFootnoteNumbering(content)`，`StorytellerWysiwygMarkdown` 新增 `footnoteNumbering`／`footnoteIdPrefix`／`showFootnoteSection` 三個可選 prop（都不提供時維持原本「自己算、自己渲染」的行為，向後相容）；尾端清單本身也拆成獨立匯出的 `StorytellerFootnoteSection` 元件。`Reader.tsx` 改成用整篇故事的完整內容呼叫一次 `computeFootnoteNumbering`、`useId()` 產生一個共用的 id 前綴，逐行渲染時把這兩者傳給每個 `StorytellerWysiwygMarkdown`（`showFootnoteSection={false}`），並在所有行渲染完之後，只呼叫一次 `StorytellerFootnoteSection`——這樣腳注編號跨標題區段連續、清單也只在整篇故事最尾端出現一次，這件事跟內容裡有沒有標題、標題怎麼分段完全無關。`extractFootnoteNotesForDiff` 順便重構成建立在 `computeFootnoteNumbering` 之上（原本兩份幾乎一樣的去重邏輯合併成一份）。
    - **已驗證**：新增 round-trip 腳本模擬「多個標題區段、腳注散落其中」的故事，確認整篇一次算出來的編號跨區段連續（1、2、3...），且證實「每行各自獨立算」（修正前的行為）確實會讓每行都從 1 重新開始編號，驗證這個修正解決的正是回報的問題；`extractFootnoteNotesForDiff` 重構後仍正確；`tsc -b`／`eslint`／`prettier` 皆乾淨；dev server smoke test 全過。同樣**未在瀏覽器實際捲動閱讀頁確認腳注視覺位置**（環境限制），建議實際操作時再確認一次。
  - 以下為原始設計分析（保留供對照）：
- [ ] （原腳注設計分析，功能已完成，保留供參考）
  - **跟現有「加註解」的本質差異**：
    1. 錨點範圍不同：「加註解」是掛在整個段落上（marker 的 `comment` 屬性），這個功能要錨在「選取的一段文字」上——是行內（inline）等級，不是段落等級，架構上比較接近粗體/斜體那種行內樣式，但多了「每個實例要帶一個獨立 id、還要帶一段文字內容」這件事，粗體/斜體目前都不需要 id。
    2. 可見性不同：「加註解」故意設計成只有作者在編輯區看得到（`commentHighlight.ts`／hover tooltip），讀者端（`StorytellerWysiwygMarkdown.tsx`／`Reader.tsx`）完全不會渲染。這個功能相反，讀者要看到：內文裡選取範圍旁邊要有個上標的編號（像 `¹`），點下去或往下捲可以跳到「這篇故事尾端」的註解清單，清單那邊照編號列出完整註解內容，通常還會有個「返回內文」的反向連結。
  - **建議的語法設計**：沿用「加註解」已經驗證過的模式——**行內 marker 直接帶著註解文字**（不是另外開一個「文件尾端才有的定義段落」去對應），一致性比較高、之後要維護的地方也比較少：
    - 新增一個行內 mark（不是段落屬性），例如 `⟦footnote-<uuid> note="跳脫過的註解文字"⟧被選取的文字⟦/footnote-<uuid>⟧`，掛在段落 `runs` 裡被選取的那一小段文字上，不是整個段落。
    - 沿用跟段落 marker 一樣的 `⟦⟧` 括號跟跳脫規則（`escapeMarkerComment`／`unescapeMarkerComment` 可以直接共用），id 前面加 `footnote-` 前綴跟段落 marker 的 id（純 UUID）做視覺區分，parser 這邊也才能簡單用前綴判斷「這是行內腳注 marker，不是段落 marker」，不用真的另外設計一套括號符號。
    - 第一版註解內文比照「加註解」目前的設計：純文字，不支援粗體/斜體等行內樣式（要支援的話之後可以再加，不影響現在的資料格式，只是先不做）。
  - **渲染面（讀者看到的部分）需要異動的地方**：
    - `StorytellerWysiwygMarkdown.tsx`：目前是單純把每個段落攤開渲染 runs；要改成先掃過全篇（所有段落）收集所有腳注 mark，依照文件順序（段落順序 + 段落內出現順序）編號 1、2、3...，內文裡渲染成上標編號＋錨點 `id`，並在所有段落渲染完之後，多渲染一個「註解」區塊，依編號列出每則的內容，且各自帶一個「回到內文」的反向連結錨點。
    - `Reader.tsx` 用的就是 `StorytellerWysiwygMarkdown`，理論上不用另外改渲染邏輯，但要留意目前 `Reader.tsx` 有自己的逐行書籤/捲動機制（`bookmark-line-{index}`），腳注的錨點/跳轉不能跟這套機制打架。
    - 編輯區（`StorytellerWysiwygEditor.tsx`）目前故意「跟閱讀頁的視覺完全不共用」（`COMMENT_HIGHLIGHT_SX` 只在編輯器生效），腳注則是「編輯區也要看得到、閱讀頁也要看得到」，兩邊的呈現方式必然不同（編輯區可能還是類似加註解的高亮＋hover，閱讀頁是上標編號＋跳轉），這點在設計上要小心別把兩套邏輯混在一起維護。
  - **編輯面（作者怎麼加）**：比照「加註解」——選取一段文字、右鍵選單或工具列按鈕開 Dialog、輸入註解內容、確認後用類似 `setComment` 的 command 把選取範圍包成新的 footnote mark。跟「加註解」不同的是這是「選取範圍」而不是「整個段落」，Tiptap 這邊要用 Mark（`addMark`／自訂 Mark extension）而不是段落屬性（`updateAttributes`）來實作。
  - **待確認（需要跟你討論的設計問題）**：
    1. 編號範圍：一篇故事（`story`）算一組編號，還是整個專案／整本書算一組？（影響：換頁/換章節後編號要不要重置）
    2. 字數統計：`wordCount()` 要不要把腳注內文算進「字數」？跟「加註解」不同——腳注內文讀者看得到，感覺上應該要算，但這會讓「本文字數」跟「本文＋腳注字數」變成兩個不同的數字，要不要分開統計還是合併算一個總數？
    3. 書籤/diff 的逐行索引：腳注是行內 marker，只要不在段落文字中插入真正的換行字元，`content.split("\n")` 的陣列長度就不會被影響，這點目前設計上沒問題，但正式動工時要另外寫測試驗證（尤其是含跳脫字元的註解內文那段，跟「加註解」當初的驗證方式一樣）。
    4. 一段文字可不可以同時被多個腳注錨定、或腳注錨點可不可以跟粗體/斜體等其他行內樣式重疊（例如錨定的文字本身還加了粗體）？如果要支援重疊，`parseInline` 現在「一次只認一種 delimiter」的掃描邏輯需要能同時疊多種 mark，這件事因為粗體/斜體/底線/上下標本來就可以疊加，機制上應該相容，只是需要額外測試覆蓋。
    5. 舊資料／既有故事要不要提供「把某個已存在的『加註解』一鍵轉成腳注」的捷徑，還是兩個功能完全獨立、互不轉換？
  - **對照「關於客製化元素」章節後的補充**：這邊提的「行內 marker」機制正好對應那邊 `type="footernote"` 的設計，方向一致。但那邊 `footernote` 底下列的屬性是 `comment`——建議還是用跟這裡一樣的 `note`（或其他不同名字），不要跟段落層級「編輯限定、讀者看不到」的 `comment` 共用同一個屬性名，避免以後讀原始序列化字串時，同一個屬性名在不同 `type` 底下代表「讀者看不看得到」完全相反的意思，容易搞混（解析/跳脫邏輯仍然可以共用程式碼，只是屬性名分開）。

- [x] **加入文字背景色／文字顏色**（選取一段文字，套用固定色盤裡的前景色和／或背景色，讀者看得到）——已實作（2026-07-09）。
  - **實作摘要**：建立了通用「行內 marker」基礎（`⟦<type>-<id> attr="..."⟧文字⟦/<type>-<id>⟧`），文字顏色是第一個消費者（`type="span"`，屬性 `textColor`／`bgColor`）。
    - `whitelist.ts`：新增 `INLINE_MARKER_TYPES`／`generateInlineMarkerId`、`TEXT_COLOR_VALUES`（red/orange/green/blue/purple）／`BG_COLOR_VALUES`（yellow/pink/blue/green/purple）色盤與 `MARKER_TEXT_COLOR_ATTR`／`MARKER_BG_COLOR_ATTR`。
    - `parser.ts`：`ParsedRun` 加 `textColor`／`bgColor`；`parseInline` 改寫成「delimiter 跟行內 marker 一起掃、先出現的優先」，支援跟粗體等互相巢狀；`stripMarkerForDiffLine` 連行內 marker 一起 strip（改顏色不會造成假 diff／不漏語法）；`paragraphsToDoc` 產出 tiptap 的 `textColor`／`bgColor` mark。
    - `serializer.ts`：`serializeParagraphInline` 從「只處理 delimiter 的堆疊」一般化成「delimiter＋帶值 span 行內 marker 共用同一套 open/close 堆疊」，span 開/關帶同一個重生的 id。
    - `inlineColorMarks.ts`（新）：`TextColor`／`BgColor` 兩個 tiptap Mark；`colorStyles.ts`（新）：值→實際色碼的固定對照表（編輯區走 class、閱讀頁走 inline style，兩邊共用這份、都不接受自填 CSS）。
    - `StorytellerWysiwygEditor.tsx`：工具列加前景色／背景色兩個色塊選單；`StorytellerWysiwygMarkdown.tsx`：閱讀端依 run 的顏色套 inline style。
    - 後端 `service/storyteller/storyteller.go`：`wordCount`／`stripBookmarkLineMarker` 都加了 strip 行內 marker（`stripStoryInlineMarkers`），字數不會被 span 語法灌水、書籤預覽也不漏 span 語法。
  - **已驗證**：TS round-trip（含顏色包粗體/粗體包顏色/相鄰兩色/diff strip/孤兒括號）14 項全過、Go 字數與書籤 strip 測試全過、`tsc -b`／`eslint`／`prettier`／`go build`／`go vet` 皆乾淨、dev server 模組載入無誤。**未在瀏覽器實際點過工具列**（環境限制），僅資料層與型別層驗證。
  - **這次的設計選擇（供腳注／連結沿用時參考）**：
    - span id 用短亂數（非 UUID），只需同一行內唯一；序列化每次重生 id（diff 端一律 strip，不造成假差異）。
    - 顏色巢狀時內層優先（`applyInlineSpanAttrs` 用 `??`）。
    - `style` 一律走「值→固定對照表」，沒有把任何使用者可控字串塞進 `style=`／`dangerouslySetInnerHTML`。
  - 以下為原始設計分析（保留供腳注/連結沿用同一套機制時對照）：
- [ ] （原文字顏色設計分析，功能已完成，保留供參考）
  - **跟腳注共通的架構重點**：兩者都是「選取一段文字、套用行內樣式，且這個樣式帶了額外的值」，跟現有粗體/斜體/底線/上下標這種「純開關、沒有附加資料」的行內樣式不一樣。這點正好呼應段落層級 marker 已經走過的路——`align`／`comment`／`commentColor` 三個屬性本來就是統一掛在同一個段落 marker 上，而不是各自發明一套語法。行內層級可以比照辦理：**設計一個通用的「行內 marker」機制**（跟段落 marker 是同一套括號/跳脫規則，只是作用在選取範圍而不是整段），色彩跟腳注都掛在這個機制上，只是帶的屬性不同：
    - 腳注：`⟦footnote-<uuid> note="..."⟧文字⟦/footnote-<uuid>⟧`
    - 文字樣式：`⟦style-<uuid> textColor="pink" bgColor="yellow"⟧文字⟦/style-<uuid>⟧`（`textColor`／`bgColor` 都可省略、也可以同時存在，跟段落 marker 的 align/comment/commentColor 都可省略是同一種設計語言）
    - 好處：parser/serializer 只需要維護「一種行內 marker 的開/關/屬性剖析邏輯」，不用因為每加一種「帶值的行內樣式」就重新發明一套括號規則；之後如果還要加其他「選取文字＋附加資料」的功能（例如連結？），都可以掛在同一個機制上。
  - **跟腳注的差異**：
    1. 腳注一定要有 id（讀者端要能把內文錨點跟尾端註解清單的項目對起來，兩者是「一對一但兩個地方都要渲染」的關係）；文字顏色理論上不需要 id 才能運作（沒有「另一個地方」需要對應），但如果共用同一套行內 marker 機制，還是會統一帶 id（純粹是機制一致性帶來的，不是這個功能本身需要）。
    2. 腳注在讀者端會多渲染出「上標編號＋尾端註解清單」這種額外的 DOM 結構；文字顏色單純是「這段文字套用 style」，渲染邏輯簡單很多（`StorytellerWysiwygMarkdown.tsx`／`StorytellerWysiwygEditor.tsx` 只要把 `textColor`／`bgColor` 轉成對應的 inline style 或 class，不需要另外收集、編號、多渲染一個區塊）。
    3. 腳注刻意限制「編輯區看得到、跟讀者端的呈現方式不一樣」；文字顏色理論上編輯區跟讀者端應該長得一模一樣（所見即所得的本意），不需要像腳注那樣切成兩套視覺邏輯。
  - **色盤設計**：比照 `commentColor` 目前「固定幾種偏亮色系，不開放自訂顏色值」的作法，避免使用者亂選顏色破壞排版一致性／可讀性。前景色跟背景色可能需要各自一組色盤（背景色偏向目前 `COMMENT_COLOR_STYLES` 那種淡色（適合當底色，文字疊上去還能讀），前景色可能需要飽和度更高、對比更明顯的顏色（紅/藍/綠等語意色），兩者訴求不完全一樣，不一定能直接共用同一份色盤定義，但可以共用同一套「固定色盤、不開放自訂」的設計原則）。
  - **編輯面（作者怎麼加）**：選取文字 → 工具列或右鍵選單開啟顏色選單（前景色／背景色兩排色塊，比照加註解 Dialog 目前的色塊 UI）→ 選色後直接用 Mark 套用到選取範圍，不需要額外 Dialog 輸入文字內容（這點比腳注簡單，腳注還要輸入註解內容）。
  - **待確認（需要跟你討論的設計問題）**：
    1. 前景色／背景色是否要分開挑選（兩個獨立的顏色選單），還是合併成一組「預設搭配」（例如選「黃底」就自動配「深色文字」，使用者不用自己搭配對比）？
    2. 色盤要跟 `commentColor` 的 5 色（yellow/pink/blue/green/purple）共用，還是文字色/背景色各自另外設計一組？
    3. 這個「行內 marker」機制如果真的做成通用機制（腳注＋文字顏色共用），要不要現在就把底層設計統一起來一次做好，還是先各自實作、之後有需要再重構成共用機制？（先各自做的風險：兩份幾乎一樣的解析/序列化邏輯要分開維護；先做通用機制的風險：範圍變大、要先想清楚兩種用法之間的所有差異點，容易卡在設計階段太久。）
    4. 文字顏色要不要也支援跟粗體/斜體等既有行內樣式疊加（例如一段紅色的粗體字）？如果要，`parseInline` 的疊加邏輯需要涵蓋這個新的行內 marker，屬於前面提到的第 4 點待確認範圍。
  - **對照「關於客製化元素」章節後的補充**：那邊把這個功能定位成 `type="span"`、樣式寫進 `style` 屬性（例如 `font-weight:bold`），等於直接回答了上面第 3 點——文字顏色跟腳注（`type="footernote"`）共用同一套「行內 marker」機制，只是 `type` 不同、帶的屬性不同，不需要再猶豫要不要統一，設計上已經是統一的。
    - 但 `style` 屬性的值**不能是使用者自由輸入的 CSS 字串**——這不只是設計選擇，是安全性要求：如果真的把使用者可控的字串直接塞進渲染出來的 `style="..."`，等於開了一個 CSS injection 的口子（例如 `background-image: url(...)` 拿來做資料外洩）。`style` 的值必須是編輯器提供的固定選項（色盤）之一，渲染端用「認得的值 → 對應的樣式」這種對照表方式套用，不能把字串原樣塞進 HTML 屬性或 `dangerouslySetInnerHTML` 之類的地方。
    - `span` 底下的原則「markdown 沒有的語法規則才優先用客製元素」這點很好，粗體/斜體/底線/上下標繼續用現有的 delimiter 語法，`span` 只留給顏色這種真的沒有對應 delimiter 語法的樣式，避免兩套語法同時能表達同一件事。

- [ ] **加入引用 `blockquote`**——目前只做設計分析，還沒實作。
  - **架構定位**：跟腳注/文字顏色（行內、掛在選取文字上）不一樣，引用是「整行/整段落」等級的樣式，這點比較接近現有的 `headingLevel`——都是「這個段落整體是什麼類型」，不是段落裡某一小段文字的樣式。建議做法：比照 `headingLevel`，新增一個段落層級屬性（例如 `isBlockquote: boolean`），序列化時用行首前綴（比照 markdown 慣例的 `> `），跟標題前綴屬於同一種設計語言（`whitelist.ts` 裡標題前綴的理由本來就是「沿用大家熟悉的 markdown 慣例」，引用的 `> ` 前綴也是同樣熟悉的慣例）。
  - **新的難題：連續段落要合併成一個視覺區塊**。這是前面幾個功能都沒遇過的情況——之前所有段落都是各自獨立渲染，沒有「好幾個段落合起來當一個整體」的需求。引用通常是連續好幾行都在引用範圍內，讀者端渲染時，連續好幾個「有 `isBlockquote` 標記」的段落，要合併包在同一個 `<blockquote>` 裡（而不是每行各自一個 `<blockquote>`，那樣視覺上會變成一行一個引用框，不是想要的效果）。`StorytellerWysiwygMarkdown.tsx` 目前是單純攤開渲染每個段落，需要改成「先把連續同類型的段落分組，再決定要不要包一層容器」——這個「分組」邏輯之後 `ul`/`ol` 也會用到（見下面）。
  - **對書籤/diff 索引沒有影響**：分組純粹是渲染時的事，底層還是每行一個段落、`content.split("\n")` 的陣列位置完全不變，書籤 `line_index`／版本 diff 都不受影響。
  - **編輯面**：工具列一顆切換按鈕（比照對齊按鈕的邏輯），對目前段落（或選取範圍涵蓋的多個段落）切換 `isBlockquote`。
  - **待確認**：
    1. 引用可不可以跟標題同時存在（一段引用文字同時是標題）？如果不行，切換引用時要不要自動把 `headingLevel` 重置成 0（反之亦然）？
    2. 引用要不要支援巢狀（引用裡面還有一層引用）？真的要做的話需要類似清單的「巢狀層級」屬性，複雜度會提高不少，第一版建議先不支援巢狀。
  - **對照「關於客製化元素」章節後的分歧點（尚未有結論）**：那邊把引用定位成 `type="quote"` marker（跟 `a`／`span`／`footernote` 同一種行內 marker 機制），但引用其實是「整個段落」等級，不是行內選取範圍——跟我在這裡建議的「比照 headingLevel 走行首前綴」是兩條不同的路，列出來給你比較：
    - **走行首前綴（`> `，我的建議）**：跟 `headingLevel` 完全同一套模式，`headingLevel` 已經證明這套「前綴決定段落種類＋段落自己的 marker 照樣帶 align/comment/commentColor」可以運作，不需要另外決定引用底下可以有哪些屬性——align/comment/commentColor 全部沿用不變。壞處是引用跟 `type="quote"` 不是同一套機制，將來要維護兩套「段落種類」的判斷邏輯（前綴 vs marker type）。
    - **走 `type="quote"` marker（文件裡的提案）**：跟 `a`／`span`／`footernote` 是同一套機制，維護上只有一套「行內／段落層級 marker」邏輯，但要重新決定 `quote` 底下能不能有 `align`／`comment`／`commentColor`（文件裡目前只列了 `comment`，不確定是不是代表引用不能置中/靠右對齊），且既然引用實際上包住的是整個段落而不是選取範圍，用「行內 marker」的機制套在「整段」上，語意上會有點不上不下（跟 `a`/`span`/`footernote` 明確是「選一小段文字」不一樣）。
    - 我目前傾向前綴那條路，但兩條都可行，你再想想。

- [x] **加入連結 `a`**——已實作（2026-07-09）。
  - **架構定位**：跟腳注一樣是「選取一段文字＋帶額外的值（這裡是網址）」，是行內層級，可以直接套用前面腳注/文字顏色那邊提到的「通用行內 marker 機制」，例如 `⟦link-<uuid> href="https://..."⟧被選取的文字⟦/link-<uuid>⟧`，不需要另外設計一套語法。三個功能（腳注／文字顏色／連結）都是「同一種行內 marker 機制、不同屬性」的話，這時候可能就有足夠的理由值得先把底層機制做成通用的（呼應前面文字顏色那邊「先各自做 vs 先做通用機制」的待確認）。
  - **安全性考量（比前面幾個功能都更需要注意）**：連結的 `href` 是要直接渲染成真的 `<a href="...">` 給讀者點的，這裡要小心 XSS——至少要限制 scheme 只能是 `http`／`https`（擋掉 `javascript:`、`data:` 等危險 scheme），渲染時 `<a>` 標籤建議加上 `rel="noopener noreferrer"`（外部連結常見的安全慣例，防止新分頁能透過 `window.opener` 操作原本頁面）。這件事不只是「設計選擇」而是「正確性/安全性要求」，正式動工時一定要做。
  - **編輯面**：選取文字 → 工具列或右鍵選單開 Dialog 輸入網址（比照腳注的 Dialog 模式，把「輸入註解文字」換成「輸入網址」，可以視需要加網址格式驗證）。
  - **待確認**：
    1. ~~要不要支援「站內連結」~~——**已決定暫緩**（2026-07-09）：`isSafeHref()` 改成只接受明確以 `http://`／`https://` 開頭的網址，不再把「沒有 scheme 的相對路徑」當成安全值。原因：站內連結牽涉到「故事是否公開」「設定集目前還沒有公開機制」這些還沒拍板的問題，等使用情境明朗後再評估要不要開放（到時候可能是另一種 `storyId`／`loreId` 屬性，也可能還是一般網址字串，先不用現在決定）。
    2. 連結文字要不要也支援跟粗體/斜體等既有行內樣式疊加？（跟腳注/文字顏色一樣的疊加問題，可以合併一起設計。）——**已驗證可行**：round-trip 測試裡「連結包粗體」「連結疊顏色」都過，機制上沒問題。
  - **對照「關於客製化元素」章節後的補充**：那邊把連結定位成 `type="a"`，屬性是 `href`／`target`，跟這裡提的「行內 marker」機制方向一致。另外補一個資安提醒：如果 `target="_blank"`（開新分頁）是選項之一，渲染成 `<a>` 時務必同時加上 `rel="noopener noreferrer"`——這是跟前面 XSS scheme 限制分開的另一個資安慣例（防止新分頁透過 `window.opener` 回頭操作原本頁面），兩個都要做，不是只做其中一個。
  - **實作摘要**：`type="a"` 加進 `INLINE_MARKER_TYPES`，語法沿用文字顏色打好的通用行內 marker 機制：`⟦a-<id> href="..." target="_blank"⟧文字⟦/a-<id>⟧`（`target` 可省略）。
    - `whitelist.ts`：新增 `MARKER_HREF_ATTR`／`MARKER_TARGET_ATTR`、`LINK_TARGET_VALUES`（目前只有 `_blank`）、`isSafeHref()`——**資安防線是限制 scheme，不是限制值**（href 本質上是自由格式，跟顏色的固定 enum 不同）：**只接受明確以 `http://`／`https://` 開頭的網址**（2026-07-09 收緊：原本用假 base 餵給 `URL` 建構子、連沒有 scheme 的相對路徑也當安全值放行，現在改成必須明確帶 scheme，暫不支援站內連結，見上面第 1 點待確認）。
    - `parser.ts`：把原本專屬顏色的 `SpanAttrs`/`parseSpanAttrs`/`applyInlineSpanAttrs` 一般化成 `InlineAttrs`/`parseInlineAttrs`/`applyInlineAttrs`，同時認得顏色跟 href/target 屬性（屬性名稱不會撞名，不需要照 marker type 分流解析）。**`parseInlineAttrs` 解析 href 時會呼叫 `isSafeHref` 防禦性檢查**——就算 DB 裡不知怎麼混進危險 scheme（手動改資料、以後的匯入功能等），解析階段也不會把它當有效連結，不能只靠編輯器輸入時的驗證這一關。
    - `serializer.ts`：`InlineWrapper` 加 `"a"` kind（href 用 `escapeMarkerComment` 跳脫，因為是自由格式值，不像顏色是 enum 不需要跳脫）。目前的巢狀順序：span（顏色）最外層 → a（連結）→ delimiter 樣式（粗體等）最內層——這只影響序列化輸出穩不穩定，解析端不假設任何順序。
    - `inlineLinkMark.ts`（新）：`InlineLink` tiptap Mark，`setLink` command 本身也重複呼叫 `isSafeHref`（第二層防禦，就算呼叫端忘記先驗證也不會套用危險網址）。
    - 編輯區：工具列加連結按鈕＋Dialog（網址輸入框即時顯示格式錯誤、「在新分頁開啟」checkbox、編輯既有連結時用 `extendMarkRange("link")` 讓整個連結範圍一起被替換而不是只有游標那一點）。閱讀端：`renderRun` 渲染 `<a>` 前**再檢查一次 `isSafeHref`**（第三層防禦，渲染永遠不假設前面的關卡一定擋過），`target="_blank"` 時加 `rel="noopener noreferrer"`。
    - 後端 `storyInlineMarkerPattern` 加 `a` 到 type 清單（原本只有 `span`），書籤預覽/字數統計才不會漏掉連結的行內 marker。
  - **已驗證**：TS round-trip 19 項全過（含連結包粗體/連結疊顏色/target=_blank/href 含跳脫字元），**專門驗證 `javascript:`／`data:` scheme 在解析階段就被擋掉、文字仍保留但不再是連結**；Go 書籤 strip／字數測試全過；`tsc -b`／`eslint`／`prettier`／`go build`／`go vet` 皆乾淨、dev server 模組載入無誤。同樣未在瀏覽器實際點過（環境限制），僅資料/型別層驗證，**Dialog 的即時錯誤提示、editor 內連結可點擊性等 UI 行為建議實際操作時再確認一次**。
  - **後續追加（2026-07-09，同一天第二輪）**：
    1. **收緊 `isSafeHref()`**（見上面第 1 點待確認）：不再接受相對路徑，Dialog 的「加入連結」按鈕原本就是靠 `disabled={!isSafeHref(...)}` 控制，收緊驗證函式後不用額外改按鈕邏輯，行為自動一起變嚴格。新增測試驗證：DB 裡如果混進舊的相對路徑連結，parser 解析時 `href` 會被濾掉（回退成純文字，不會壞掉，只是不再是連結）。
    2. **把粗體/斜體/底線/上下標/文字色/背景色/連結都整合進右鍵選單**，跟工具列的動作一致，不用特別移到工具列才能套用格式。
    3. **順便修掉一個右鍵選單的既有 bug**：`handleEditorContextMenu` 原本不管三七二十一，右鍵點哪就把選取範圍收合成那個單點——這在「只有加註解」的年代沒差（加註解本來就是套在整個段落上，跟游標實際位置無關），但這次要在右鍵選單裡加粗體/顏色/連結這些「套在選取範圍上」的動作後，這個行為會變成 bug：使用者選了一段文字、在選取範圍**裡面**按右鍵想套格式，選取範圍卻被收合掉，套用動作會失效。修法：只有在右鍵點的位置**落在目前選取範圍外面**時才收合成單點，點在範圍裡面就維持原本的選取範圍不動。

- [ ] **加入清單 `ul` / `ol` > `li`**——目前只做設計分析，還沒實作，三個裡面架構最複雜的一個。
  - **架構定位**：跟引用一樣是段落層級屬性（例如 `listType: "none" | "bullet" | "number"`），一樣需要「連續段落分組成一個視覺容器」（沿用引用那邊提到的分組渲染邏輯，`ul`/`ol` 的分組規則更複雜一點：連續的 bullet 項目分成一組 `<ul>`；如果中間穿插一個 number 類型的段落，就要斷成兩組，各自包自己的 `<ul>`/`<ol>`，不能混在同一個清單容器裡）。
  - **比引用更複雜的地方**：
    1. **巢狀層級**：真正的清單通常需要支援子清單（縮排一層）。如果要支援，段落屬性還要再加一個 `listIndentLevel`（0 到 N），渲染時要把巢狀結構還原成真正的 `<ul><li><ul>...` 巢狀 DOM，比引用的巢狀（本來就建議先不支援）複雜得多。**建議第一版直接不支援巢狀**，只做單層清單，之後有需要再加。
    2. **有序清單的編號**：使用者打字時看到的數字（`1.` `2.` `3.`）要不要真的存到資料裡，還是只存「這是一個有序清單項目」，數字永遠由渲染端依照分組內的順序自動算（比照大多數 markdown 渲染器的行為，使用者打的數字通常只是輔助，實際編號看清單裡的順序）？如果採用自動編號，中間插入/刪除一個項目時不需要手動調整後面所有項目的數字，維護上簡單很多，建議採用這個做法。
    3. **Enter／Backspace 的按鍵行為**：現有 `markerParagraph.ts` 的 Enter 已經有一套「分割段落、新段落重置 markerId/heading/comment」的邏輯；清單通常還需要「在清單項目按 Enter 會建立下一個清單項目（延續 `listType`，不是重置成一般段落）」「在空白清單項目按 Enter 會跳出清單（listType 重置為 none）」這類額外規則，屬於這個功能自己需要另外設計的按鍵邏輯，不能直接沿用現有的 Enter 處理。
  - **對書籤/diff 索引沒有影響**：跟引用一樣，分組跟巢狀層級都只是段落屬性＋渲染時的事，`content.split("\n")` 的行數／位置不受影響。
  - **編輯面**：工具列兩顆切換按鈕（bullet／number），Tab／Shift+Tab 增加/減少縮排層級（如果決定支援巢狀的話）。
  - **待確認**：
    1. 是否真的需要巢狀清單，還是第一版單層清單就夠用？（強烈建議先不做巢狀，之後有明確需求再加，複雜度差很多。）
    2. 清單項目本身可不可以是標題／引用？（建議不行，三者互斥，一個段落只能是其中一種「段落類型」，簡化很多設計跟渲染上的邊界情況。）
  - **對照「關於客製化元素」章節後的補充**：那邊你自己也還在猶豫要不要直接用 markdown 原生的 `-`／`*`／`1.2.3.` 前綴，而不是走 marker `type="list"`。我的建議是走前綴——理由跟引用那條一樣：這樣可以直接沿用 `headingLevel` 已經驗證過的「前綴決定段落種類＋段落自己的 marker 照樣帶 align/comment/commentColor」模式，不需要另外決定 `list` 底下能有哪些屬性；壞處一樣是跟 `a`/`span`/`footernote` 的 `type=` 機制不同路。這條我建議前綴優先於引用那條（列表本來就是最貼近「大家已經熟悉的 markdown 語法」的一種，`- `／`1. ` 幾乎沒有人會誤用來表達別的意思），但最終還是同一個分歧點，兩條選一條，兩種段落種類（引用/列表）最好走同一條路，不要一個走前綴一個走 marker type，不然「段落種類」判斷邏輯會變成兩套。

# TBD / TODO
- [ ] 斜體的輸入捷徑跟白名單文件不一致：官方 `@tiptap/extension-italic` 內建 `_文字_`（單底線）的 input rule 會自動觸發斜體，但 `whitelist.ts` 只把 `*` 列為斜體的合法語法，沒有把單底線列進去（對照粗體：`**`／`__` 都有明確列在白名單裡，是刻意支援的別名，斜體的底線捷徑則不是）。不影響正確性——存檔序列化回去一律用 canonical 的 `*文字*`，不會真的寫入底線語法——只是編輯區目前多開了一個沒寫進規格的輸入捷徑。先擱著，之後要動的話是在 `wysiwygCore/extensions.ts` 的 `Italic` 擴充上用 `.extend()` 覆寫 `addInputRules()`，只留 `*` 觸發、拿掉底線觸發。


# 實作決策（2026-07-09 討論定案）
- **語法策略＝混合式**：區塊層級的「段落種類」（標題、引用、清單）走行首前綴（`# `／`> `／`- `／`1. `），沿用現有 `headingLevel` 已驗證的模式；行內層級（文字顏色、腳注、連結）走一套**新的通用「行內 marker」機制**。兩者共用同一組括號符號（`⟦⟧`）跟跳脫規則，但是兩套獨立的解析/序列化邏輯（段落 marker 是整行 `^...$`、行內 marker 是段落內容裡的子字串）。
  - 因此下面「關於客製化元素」章節的「全統一 `type=`（連 p 都改）」提案**不採用**——p/引用/清單維持段落層級（前綴或段落屬性），只有 `a`／`span`／`footernote` 走行內 marker。
- **行內 marker 語法**：`⟦<type>-<id> attr="..."⟧被套用的文字⟦/<type>-<id>⟧`，其中：
  - `<type>` = 行內元素種類（`span` 文字樣式／之後的 `footnote`／`link`），放在 id 前綴，parser 用前綴判斷種類，也讓行內 marker 跟段落 marker（純 UUID、無 `type-` 前綴）天生可區分。
  - `<id>` = 每個實例一個短亂數（只需在同一行內唯一，因為行內 marker 不跨行），確保巢狀／相鄰時 open/close 能正確配對。序列化時每次重新產生（diff 端一律 strip marker，所以 id 變動不會造成假差異）。
  - 屬性值一律走 `escapeMarkerComment`／`unescapeMarkerComment`（跟段落 marker 共用），attr 順序固定，省略代表沒設定。
- **實作順序**：先做**文字顏色**（最小的行內功能：不需要 id 語意、不需要尾端清單、編輯區==閱讀頁），藉此把「帶值的行內 mark」整條 parser/serializer/tiptap/編輯區/閱讀頁/後端字數 管線建好；腳注、連結之後沿用同一套機制。
  - 文字顏色 = `type="span"`，屬性 `textColor`／`bgColor`（都可省略、可並存），值一律取自固定色盤（不開放自填 CSS，渲染端用「值 → 樣式對照表」套用）。

# 關於客製化元素
> 註：下面是使用者原始的想法草稿。已於上方「實作決策」章節定案（區塊元素改走前綴、只有行內元素走通用 marker，`style` 不採「使用者自填 CSS 字串」而是固定色盤對照）。保留原文供對照。

統一使用 `⟦markerID ......⟧⟦/markerID⟧` 處理，且必須有以下元素：
- `type`：定義元素類型，若未指定則預設為`段落` `p`。可支援 `a`（建立連結） `span`（建立文字樣式） `quote`/`blockquote` （引用） `list` 列表 `footernote` 腳注
- `style`：用於將元素根據 css 方式渲染，原則上不開放給使用者自填 css，而是由編輯器設定可用的 css， renderer 自行渲染

## 每個客製化元素支援屬性
### p 
同目前預設，主要有：
- align
- comment
- commentColor
其中 align 和 commentColor 或許可以整併到 `style` 內

### a 
- href
- target
原則上不定義 style

### span
根據需求將樣式寫進 style 內，例如粗體可以 `font-weight:bold` 之類的。當然這裡以 markdown 沒有的語法規則才優先使用客製元素。

### quote/blockquote
- comment

### list 
有在想也許直接用 markdown 的 `-` `*` 還是 `1.2.3` 就好，但我還不確定。

### footernote
- comment

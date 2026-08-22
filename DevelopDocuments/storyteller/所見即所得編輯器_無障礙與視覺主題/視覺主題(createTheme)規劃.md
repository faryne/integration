# Storyteller 客製視覺主題規劃（以 createTheme 為基礎）

2026-08-17 由 Faryne 提出、Claude／Codex 討論收斂。**這份文件只做規劃，不動 code**——Faryne 要等 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的 Phase 9 人工驗收跑完後才會安排時間處理，避免視覺改動跟功能驗收混在一起。

## 背景與範圍決定

起因是 Faryne 問「這個編輯器如果不用 MUI、改客製設計語言，效益/成本/風險如何」。討論過程（詳見對話紀錄，不重複列在這裡）收斂出幾個關鍵結論：

1. **不整站換掉 MUI**，只針對 storyteller 這條產品線——因為 storyteller 已經有自己風格明確的 Steam 齒輪／黃銅 layout，但 Dialog／Menu／TextField 這些互動元件還是 MUI 預設樣式，會有「世界觀外物件」的割裂感；其他子站沒有這個問題，不需要跟著換。
2. **不移除 MUI，只換皮**：MUI 底層的 focus trap、keyboard navigation、ARIA、portal stacking、mobile 行為都是成熟、踩過坑的東西，自己重刻風險高、效益低。真正該做的是用 MUI 的 `createTheme` + `components` overrides 機制，把這些元件的視覺跟狀態語言換成 storyteller 自己的風格，行為邏輯完全不動。
3. Storyteller 頁面裡最需要處理的高用量互動元件（`src/pages/storyteller/*.tsx` + `wysiwygCore/*.tsx` 統計）：Tooltip 216、MenuItem 159、TextField 121、Dialog 60（Title/Content/Actions 各約 50）、Menu 36、Tab 17／Tabs 15、Drawer 12。真正「貴」的不是視覺本身，是這些元件背後的互動邏輯，所以維持 MUI 元件、只套 theme override，是成本效益最好的做法。

## 現況盤點（開始規劃前務必先確認，很多基礎其實已經做好了）

- `src/layouts/StorytellerLayout.tsx` 已經有 `createTheme()`，套用 `storytellerThemeTokens[palette][mode]`，包含 `palette`／`shape.borderRadius`／`typography`。**目前完全沒有 `components:` overrides**——Dialog／Menu／TextField／Tabs／Drawer 這些元件的邊框、圓角、陰影、hover/focus 狀態，全部還是 MUI 原生樣式，只有顏色跟字體吃到 storyteller 的 token。
- **明暗模式已經做好**：`mode: "light" | "dark"`，由 `StorytellerThemeModeContext`（[storytellerThemeMode.tsx](../../../static_site/src/layouts/storytellerThemeMode.tsx)）管理，存 localStorage，預設跟隨系統 `prefers-color-scheme`，UI 上有切換按鈕（`StorytellerLayout.tsx` header）。
- **色系切換已經做好**：`src/data/storytellerTheme.ts` 定義了 11 組色系（brass／bronze／malachite／verdigris／steel／cobalt／violetCopper／roseCopper／inkBlack／silver／plainWhite），每組都有 light/dark 兩份 token（brass/copper/patina/ember/bg/surface/surfaceRaised/border/borderStrong/text/textMuted），由 `SteamPaletteSwitcher` 元件切換，存 localStorage。
- **節慶活動主題完全沒有**：程式碼裡搜不到任何 seasonal/holiday 相關機制。
- **無障礙功能幾乎沒有專門處理**：只有 `PublicHome.tsx` 有一點點，editor／reader 相關頁面沒有系統性處理過。

所以 Faryne 列的四個工作項裡，「明暗變化」「色系變化」的**資料層**已經有了，缺的是**套用範圍**——目前這層 theme 只影響顏色跟字體，元件的結構性樣式完全沒動過。

**2026-08-17 更新**：Faryne 在 Phase 9.1 案例 3 實測發現右鍵選單跟 slash 選單顏色風格不一致（root cause 跟修法見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 7 項），Faryne 認為 createTheme 施作時間還沒定，這個具體 bug 不該卡在後面，已經提前處理掉了：`StorytellerLayout.tsx` 的 `createTheme()` 已經開了 `cssVariables: true`（MUI 會把 palette 同步成 `--mui-palette-*` CSS variables），slash 選單也已經改吃這些變數。這代表 Phase A／B 開始時，`cssVariables` 這個底層開關已經不用再開一次，可以直接沿用；`slashCommandExtension.tsx` 也已經是一個「手刻 DOM 吃 CSS variables」的參考範例，Phase C 要處理 bubble menu／table menu／context menu 時可以照抄同樣的模式。

## 工作 Checklist（2026-08-17 新增，實際施作用）

Faryne 確認後才開始動工。每個 Phase 完成一個項目就打勾，一個 Phase 全部打勾後 commit 一次（不是每個 checkbox 都各自 commit）——跟這份文件其他地方一樣，勾了才代表真的做完＋驗證過，不是「打算做」。範圍只到 Phase A~E（實際 createTheme 視覺工作）；Phase F（閱讀頁版面比照工作台）跟 Phase G（圖片相關功能性問題）都還沒排定範圍/時程，不在這次施作範圍內，不會出現在下面的 checklist 裡。

### Phase A：Theme semantic token 整理 ✅ 已完成（2026-08-17）
- [x] 在 `storytellerTheme.ts` 或新檔案定義 semantic token 型別（`storyteller.surface.base/raised/overlay`、`border.subtle/strong`、`text.primary/muted`、`accent.main/hover`、`focusRing`、`danger`、`selection`、`editor.paper`、`editor.menu`）——新增獨立檔案 [storytellerSemanticTheme.ts](../../../static_site/src/data/storytellerSemanticTheme.ts)（不是塞進已經 450 行的 `storytellerTheme.ts`），定義 `StorytellerSemanticTokens` 介面，14 個 key 都照規劃列的名字
- [x] 把現有 11 色系 × light/dark 的 raw token（brass/copper/patina...）對應到 semantic token——`toStorytellerSemanticTokens()` 做轉換，映射表：`surfaceBase←bg`、`surfaceRaised←surface`、`surfaceOverlay←surfaceRaised`、`borderSubtle←border`、`borderStrong←borderStrong`、`textPrimary←text`、`textMuted←textMuted`、`accentMain←brass`、`accentHover←focusRing←selection←brassBright`、`danger←ember`、`editorPaper←surface`、`editorMenu←surfaceRaised`。順便把原本完全沒被用到的 `surfaceRaised`／`borderStrong`／`ember` 三個 raw token 派上用場（`git grep` 確認過，Phase A 之前這三個 key 只有定義、沒有任何地方讀取）
- [x] 確認 semantic token 也透過 `cssVariables` 曝露成 CSS custom property（例如 `--storyteller-surface-base`）——`storytellerSemanticTokensToCssVariables()` 產生 14 組 `--storyteller-*` 變數，`StorytellerLayout.tsx` 用 `<GlobalStyles>` 掛在 `:root` 上，跟 `theme` 用同一份 `[mode, palette]` 依賴確保同步。沒有依賴 MUI 的 `cssVariables` 自動產生機制（那個只認識標準 palette 欄位，semantic token 這種自訂命名塞不進去），改成手動注入，行為更可預期
- [x] 驗證：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過（既有測試沒有因為新增檔案而壞掉）。瀏覽器實測：`brass-dark`（預設）、`plainWhite-light`、`inkBlack-dark` 三組色系，讀 `getComputedStyle(document.documentElement)` 的 14 個 `--storyteller-*` 變數，逐一比對跟對應 raw token 完全一致；切換深色/淺色模式、切換色系都會即時更新，沒有殘留舊值

### Phase B：MUI components override ✅ 已完成（2026-08-17～2026-08-18）
- [x] `MuiDialog`／`MuiDialogTitle`／`MuiDialogActions`（`MuiDialogContent` 沒有另外覆寫——內容排版本來就該讓各自的 Dialog 內容自己決定，不該在 theme 層統一 padding/背景）
- [x] `MuiMenu`／`MuiMenuItem`／`MuiPopover`
- [x] `MuiTooltip`
- [x] `MuiButton`／`MuiIconButton`（沒有分別覆寫，兩者共用底層 `MuiButtonBase`，改一次兩邊都吃到）
- [x] `MuiTextField`／`MuiOutlinedInput`／`MuiInputLabel`／`MuiFormHelperText`
- [x] `MuiTabs`／`MuiTab`
- [x] `MuiDrawer`
- [x] 驗證：新增 [storytellerComponentOverrides.ts](../../../static_site/src/data/storytellerComponentOverrides.ts)，接上 `StorytellerLayout.tsx` 的 `createTheme({ components: storytellerComponentOverrides() })`。全部用 `var(--storyteller-*)` 字串字面值（跟 slash menu 同模式），不用重新算 `[mode, palette]`。`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。

  瀏覽器實測（brass-dark）：
  - Tooltip：`/storyteller` 公開首頁 hover 搜尋圖示，`getComputedStyle('.MuiTooltip-tooltip')` 讀出 `bg: rgb(47,36,25)`／`border: 1px solid rgb(74,58,40)`／`color: rgb(240,230,210)`，逐一對應 `surfaceOverlay`／`borderSubtle`／`textPrimary` token 完全一致。
  - `MuiOutlinedInput`：公開首頁搜尋框，focus 時 `.MuiOutlinedInput-notchedOutline` border `rgb(201,151,79)`＝`accentMain`（`#c9974f`）、寬度 2px；blur 後回到 `rgb(74,58,40)`＝`borderSubtle`，兩個狀態都對上。
  - `MuiChip`／`MuiDivider`：公開首頁故事卡片上的「3 部作品」「圖片／漫畫」「普通級」等 32 個 Chip，`backgroundColor: rgb(36,27,20)` 精確對上 `surfaceRaised`（`#241b14`），`border`／分隔線的 `rgb(74,58,40)` 對上 `borderSubtle`。
  - 以上三項證明 CSS variable 機制端到端可用（第一批／第二批／後續都用同一套 `var()` 寫法，機制相同）。

  **沒有即時畫面確認的項目**：Dialog／Menu／MenuItem／`MuiButtonBase` focus-visible／`MuiTabs`／`MuiTab`／`MuiDrawer`／`MuiSelect`／`MuiAutocomplete`／`MuiSwitch`／`MuiRadio`／`MuiCheckbox`／`MuiSnackbarContent`／`MuiAlert`。逐一排查過公開（免登入）頁面找不到觸發點：`/storyteller/wysiwyg-demo` Playground 完全沒套 ThemeProvider；`/storyteller/work/...` 閱讀頁的「版本歷史」清單經 DOM 檢查是手刻 div、不是 `MuiMenu`；閱讀頁的「目錄／書籤／頁面一覽」切換鈕經 DOM 檢查是 `MuiButton`（contained/outlined），不是 `MuiTabs`；行動版寬度下「開啟索引」按鈕點擊後 DOM 查無 `.MuiDrawer-root`（索引面板是 inline 收合，不是 Modal Drawer）；公開頁面沒有 Select/Autocomplete/Switch/Radio/Checkbox/Snackbar/Alert 的使用場景；工作台頁面需要登入，登入會觸發 Firebase Auth 彈窗，依照標準禁止代為完成登入。這些項目只靠 TypeScript slot 名稱型別檢查通過＋跟已驗證的 Tooltip／OutlinedInput／Chip／Divider 相同的 `var()` 機制做間接佐證。之後 Faryne 自己在已登入頁面看一眼視覺有沒有跑掉即可，不需要另外排查。
- [x] `MuiSelect`／`MuiAutocomplete`／`MuiSwitch`／`MuiRadio`／`MuiCheckbox`／`MuiSnackbar`／`MuiAlert`／`MuiDivider`／`MuiChip`（原本規劃為低優先「後續」項目，2026-08-18 一併做完，做法/驗證狀況同上）

### Phase C：Editor 專屬操作 UI 對齊 ✅ 已完成（2026-08-18）
- [x] Slash menu（`slashCommandExtension.tsx`）——原本讀 `var(--mui-palette-*)`（Phase A 之前的過渡寫法），改成直接讀 `var(--storyteller-editor-menu)`／`--storyteller-text-primary`／`--storyteller-border-subtle`／`--storyteller-text-muted`；選中項目的高亮色也從 `--mui-palette-action-selected`（半透明、跟主色連動但不是任何一個 semantic token）改成 `--storyteller-selection`，跟右鍵選單 `MenuItem.Mui-selected` 用同一個顏色來源
- [x] Bubble menu（`StorytellerWysiwygBubbleMenu.tsx`）——實際檢查發現不是「Phase B 做完自動對齊」：`<Paper elevation={4}>` 沒有另外設 `bgcolor`，會落到 MUI 預設的 `background.paper`（＝ semantic `surfaceRaised`），比 Dialog/Menu/slash 選單統一使用的 `surfaceOverlay` 低一層，並排比較時會「淡一階」。主工具列 Paper 跟兩個色票 popover Paper 都補上明講的 `bgcolor: "var(--storyteller-editor-menu)"`（＝`surfaceOverlay`），跟其他選單拉齊層次
- [x] Context menu（`StorytellerWysiwygContextMenu.tsx`）——純 MUI `<Menu>`，Phase B 的 `MuiMenu`／`MuiMenuItem` override 直接吃到，不需要改 code；`divider`（swatch 邊框用的 `borderColor: "divider"`）在 `StorytellerLayout.tsx` 的 `createTheme()` 裡本來就設成 `tokens.border`（＝semantic `borderSubtle`），跟其他選單邊框色是同一個值，確認過沒有另外要改的地方
- [x] Table menu（`StorytellerWysiwygTableMenu.tsx`）——跟 Bubble menu 同樣的 Paper 層次問題，同樣補上 `bgcolor: "var(--storyteller-editor-menu)"`
- [x] Image settings dialog（`assetImageNode.tsx` 裡的 `<Dialog>`）——純 MUI `<Dialog>`，Phase B 的 `MuiDialog` override 直接吃到，不需要改 code
- [x] 驗證：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。**這四個手刻/半手刻選單（slash／bubble／table menu）都在 editor 內才會出現，沒有免登入頁面可以觸發彈出畫面**（跟 Phase B 遇到的限制相同：Playground 路由完全沒套 `StorytellerLayout`／ThemeProvider，`/storyteller/work/...` 工作台需要登入），所以改用等效驗證：直接在已載入 `StorytellerLayout` 的公開頁面讀 `getComputedStyle(document.documentElement)`，確認 `--storyteller-editor-menu` 跟 `--storyteller-surface-overlay` 數值完全相同（`#2f2419`，brass-dark）——這代表 Bubble/Table menu 新加的 `bgcolor: var(--storyteller-editor-menu)` 跟 Dialog/Menu 用的 `surfaceOverlay` 背景色一定是同一個值，選單背景層次在 token 層級上已經對齊，不再是「三種不同選單長相」；`--storyteller-selection`／`--storyteller-border-subtle`／`--storyteller-text-primary`／`--storyteller-text-muted` 也都讀出預期的 hex 值。實際彈出畫面的並排截圖留給 Faryne 自己在已登入的 editor 頁面順手看一眼即可。

### Phase D：節慶活動 overlay 機制 ✅ 已完成（2026-08-18）
- [x] 定義 `StorytellerSeasonalTheme` 型別跟資料結構——新增 [storytellerSeasonalTheme.ts](../../../static_site/src/data/storytellerSeasonalTheme.ts)，`StorytellerSeasonalOverlayTokens` 刻意用 `Pick` 限定只能覆寫 `accentMain`／`accentHover`／`focusRing`／`selection`／`borderStrong` 這五個裝飾性 key（型別層級擋住，不是靠口頭約定），`activeWindow`／`decorations` 兩個第一版用不到的欄位如規劃保留但不強制填
- [x] 實作 `base + seasonal overlay` 的 merge 邏輯——`mergeStorytellerSeasonalTokens(base, seasonId)` 用 `{ ...base, ...overlayTokens }`，`season: "none"` 對應的 `overlayTokens` 是空物件，回傳值在數值上等於 base 本身
- [x] UI：新增 [SteamSeasonalSwitcher.tsx](../../../static_site/src/components/storyteller/SteamSeasonalSwitcher.tsx)，放在 `SteamPaletteSwitcher` 正下方（`StorytellerLayout.tsx` 頁尾），點節慶按鈕＝切換 active/inactive（再點一次已啟用的節慶＝關掉，不需要另外一顆關閉鈕）；新增 [storytellerSeasonalMode.tsx](../../../static_site/src/layouts/storytellerSeasonalMode.tsx) 提供 Context＋localStorage 存取，完全比照既有 `storytellerPaletteMode.tsx`／`storytellerThemeMode.tsx` 的寫法（同一套「未選過或存的值不合法時退回預設」邏輯）
- [x] 示範節慶：中秋節（Faryne 指定，不是文件原本建議的聖誕節）。`accentMain #e6b143`／`accentHover #f5cc6e`／`focusRing #f5cc6e`／`selection #f0c26a`／`borderStrong #8a6a3a`，月光金色調，比預設 brass（`#c9974f`）更亮更黃；只動這五個 key，不碰 `surfaceBase`／`textPrimary`／`textMuted`，也不去動 danger（MUI severity 色系是元件層自己決定，不歸這層管）
- [x] 驗證：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。瀏覽器實測（brass-dark）：切到「中秋節」後 `getComputedStyle(document.documentElement)` 讀出的 5 個 `--storyteller-*` 變數精確對上 overlay 設定值；`/storyteller` 公開首頁搜尋框 focus 邊框從 `rgb(201,151,79)`（brass accentMain）變成 `rgb(230,177,67)`（中秋 accentMain）；AppBar／首頁 Hero 按鈕等直接吃 `theme.palette.primary`（＝ `tokens.brass`，不經過 semantic 層）的地方顏色不變，符合「只換裝飾性強調色，不是整站變色」的設計；關閉節慶後 `localStorage` 存回 `"none"`、`accentMain` 精確回到 brass 原值 `#c9974f`，畫面截圖確認首頁視覺跟切換節慶前逐位元一致。**Faryne 要求的收尾動作已完成**：實測完把節慶切回「無」（`none`），commit 送出時預設狀態是關閉的，不影響任何既有使用者。

### Phase E：無障礙功能 audit／修正
- [x] Slash command：鍵盤導覽、IME 組字期間按鍵攔截、Escape/Enter 語意、補 `aria-activedescendant`——2026-08-19 完成。鍵盤導覽（上下鍵/Enter/Escape）、IME 組字期間暫停攔截這幾項在 slash 選單這次連續三輪修復（見所見即所得編輯器notion-like分析_定案版.md 已知 Bug 記錄第 8 項）時就已經到位，本次只需要補 `aria-activedescendant`：真正的鍵盤 focus 全程留在 ProseMirror 的 contenteditable 上（典型「virtual focus」情境），螢幕閱讀器沒辦法從「focus 移動」知道使用者選到哪個選項，改在 `editor.view.dom`（真正持有 focus 的元素）上設 `aria-expanded`／`aria-controls`（指到選單 id）／`aria-activedescendant`（指到目前高亮選項 id），選單關閉時全部清掉；選單本身跟每個選項補上對應的 `id`。已用假登入機制在真實登入頁面驗證：開啟時三個屬性正確設定、`ArrowDown` 後 `aria-activedescendant` 正確指到下一個選項、`Escape` 關閉後三個屬性正確清空，console 無錯誤。
- [x] Bubble menu：確認螢幕閱讀器能理解目前狀態（選取文字後浮動選單出現這件事本身要能被輔助技術偵測到）——2026-08-19 完成。個別按鈕本來就有 `aria-label`／`aria-pressed`（沿用既有寫法），這次補的是缺口：①外層 `Paper` 補 `role="toolbar"` `aria-label="文字格式工具列"`，讓輔助技術能把浮動的一整排按鈕辨識成一個有名字的工具列，而不是一堆孤立的按鈕；②文字顏色／背景色是自訂的小 popover（不是 MUI Menu），觸發按鈕補 `aria-haspopup="true"`／`aria-expanded`／`aria-controls`，popover 本身補 `id`／`role="group"`／`aria-label`；③補 Escape 關閉 popover 並把 focus 還給觸發按鈕（原本沒有任何鍵盤關閉路徑，開了只能用滑鼠點色票或點外面關掉，而且點外面也沒有實作，等於鍵盤使用者打開後關不掉）。已用假登入機制在 Playground 驗證（`role="toolbar"` 正確出現、`aria-expanded` 開合狀態正確、Escape 後 popover 消失且 focus 正確回到觸發按鈕），console 無新增錯誤。
- [x] 右鍵選單：確認 mobile／keyboard-only 情境下有替代入口能做到同樣的事（不能只靠右鍵這一種入口）——2026-08-19 完成，逐項盤點結果：
  - 標題／區塊種類／對齊／插入表格／插入圖片：slash 選單（打 `/`）都有對應入口，跟右鍵選單共用 `BLOCK_OPERATION_GROUPS`（見已知 Bug 記錄第 8 項），觸控/鍵盤都能用。
  - 圖片版面設定：圖片節點本來就有一直可見（不需 hover/右鍵）的「圖片設定」`IconButton`，加上雙擊直接開對話框，兩條路徑都不靠右鍵。
  - 連結／腳注／註解的新增、編輯、移除：bubble menu（選取文字後浮動出現，觸控長按選字／鍵盤 Shift+方向鍵都能觸發）的對應按鈕會開 Dialog，Dialog 裡都有明講的「移除」按鈕（`handleRemoveLink`／`handleRemoveFootnote`／`handleRemoveComment`），右鍵選單的「快速移除」只是這條路徑的捷徑，不是唯一入口。
  - 文字/背景顏色：Phase 4 已經因為同樣的理由（觸控裝置右鍵事件放行給原生長按選字，見已知 Bug 記錄第 9 項）補進 bubble menu，不靠右鍵。
  - **抓到一個真的問題並修掉**：註解／腳注的 hover tooltip 文字寫死「右鍵可編輯或移除」，這句話對摸不到右鍵的使用者是錯誤資訊（雖然這個 tooltip 本身是滑鼠 hover 觸發、觸控使用者本來就看不到，但螢幕閱讀器/切換裝置使用者可能用滑鼠模擬操作看得到）。改成「右鍵，或選取文字後用格式列可編輯／移除」，跟 `StorytellerWysiwygSyntaxDrawer.tsx`（語法說明側欄）原本就正確並列兩條路徑的寫法一致。已用瀏覽器實測確認新文案正確渲染。
- [x] 表格 cell 選取：確認 ProseMirror table selection 機制跟一般 keyboard navigation 沒有互相干擾——2026-08-20 完成。
  - **程式碼審查**：`markerParagraph.ts` 的 Backspace handler 一開始就檢查 `!selection.empty` 才處理，`CellSelection`（跨多個儲存格選取）本身 `.empty` 是 `false`，會直接 `return false` 交給 `tableEditing()` 自己的 `deleteCellSelection` 處理，不會被攔截；Enter handler 對 `CellSelection` 解析出來的 `$from.parent` 是 `tableCell`（不是 `paragraph`），一樣安全地 `return false` 不做任何事。Tab／Shift-Tab 是我們自己接的 `goToNextCell`，含 IME 組字期間暫停攔截。程式碼層面沒有互相干擾。
  - **瀏覽器實測**：Tab／Shift-Tab 用真實按鍵測過，正確在 cell 之間移動且不吃掉文字。多選 cell 這件事（`CellSelection`）在這次測試環境下用真實鍵盤手勢（Shift+方向鍵在 cell 邊界跨儲存格）沒能穩定重現——跟這次連續 slash 選單修復時遇到的同一個已知限制一樣，`computer` 工具的合成鍵盤事件對「ProseMirror/第三方套件自己的預設 keymap 邏輯」不可靠，不是我們自己接的 command 才會這樣。改用兩個更直接的方式驗證：① 直接用 `CellSelection` 建構子建立一個真正跨兩個儲存格的選取並 dispatch，確認 `.selectedCell` decoration class 正確出現在兩個 `<td>` 上；② 直接呼叫 `deleteCellSelection(state, dispatch)`（`tableEditing()` 背後實際處理 Backspace 的函式）確認能正確清空選取儲存格的內容、選取狀態維持不變、不拋錯——這就是「Backspace 鍵真的按下去」最終會執行的程式碼路徑，等於間接驗證了鍵盤路徑本身沒問題，只是自動化工具沒辦法用合成事件觸發到它。
  - **抓到一個真的問題並修掉**：`CellSelection` 選到的儲存格完全沒有對應的 CSS——`tableEditing()` 有正確加上 `.selectedCell` class，但全站沒有任何樣式規則吃這個 class，使用者選取多個儲存格時畫面上完全看不出來選了哪些格子。補上 `& td.selectedCell` 規則，跟圖片/表格 NodeSelection 用同一組 `var(--storyteller-selection)` token（半透明疊色，不搶走文字可讀性）。已用瀏覽器截圖＋`getComputedStyle` 確認新樣式正確套用。
- [x] 圖片版面控制：NodeSelection、圖片設定 dialog、右鍵入口都要有鍵盤可達的替代路徑——2026-08-20 完成，純審查＋瀏覽器實測，**沒有改任何程式碼**：圖片節點的「圖片設定」／「移除資產」`IconButton` 本來就是一直可見（不是 hover 才出現）、`tabIndex:0`、有 `aria-label` 的真正 `<button>`，不是只能靠右鍵或雙擊才能觸發。用真實 Tab 鍵測過：游標在圖片前一行文字時按 Tab，直接、正確地依序停在「圖片設定」「移除資產」兩個按鈕上（一般會擔心 contenteditable 裡的巢狀互動元件會被瀏覽器當成同一個 tab stop 跳過，但這個節點是 `contentEditable={false}` 的獨立小島，瀏覽器對這種島內的真實互動元件維持正常 tab 順序，不受外層 contenteditable 影響）；按鈕本身用滑鼠點擊（模擬鍵盤 Enter 觸發的等效行為）能正確開啟「圖片設定」對話框，對話框裡的「版面」下拉選單已經涵蓋右鍵選單裡 4 個 layout quick action 的內容，等於右鍵能做的事都能從這裡鍵盤操作完成。NodeSelection 本身（選到圖片節點）也不需要額外程式碼——ProseMirror 對 `atom:true` 節點的預設行為是方向鍵跨過去就自動轉成 NodeSelection，這是鍵盤原生就有的能力，不是滑鼠專屬。
- [x] 寫一支對比度檢查 script，跑過全部色系組合（11 色系 × light/dark，若 Phase D 已完成則含節慶 overlay），檢查文字/背景、按鈕、menu active 狀態、focus ring 至少過 WCAG AA——2026-08-19 已完成，見下方「對比度檢查結果」小節
- [x] 對 slash／bubble／context menu 補齊明確的 `aria-label`／`role`——2026-08-20 完成。盤點下來 bubble menu 在 Phase E 第二項已經補過（`role="toolbar"` `aria-label="文字格式工具列"`＋色票 popover），這次補剩下兩個：slash 選單的 `role="listbox"` 補上 `aria-label="斜線指令選單"`；右鍵選單是 MUI `<Menu>`，`aria-label` 直接放在 `<Menu>` 上不會轉送到實際 `role="menu"` 的 `MenuList` 元素，改用 `MenuListProps={{ "aria-label": "編輯器右鍵選單" }}` 才會生效。已用瀏覽器 `getAttribute('aria-label')` 逐一確認三個選單都正確讀到對應文字，`tsc --noEmit`／`vitest` 45/45 通過，console 無新增錯誤。
- [x] 驗證：跑過對比度檢查 script 沒有異常；鍵盤（不用滑鼠/觸控）走過一次「開始寫作 → 套用格式 → 插入表格/圖片 → 存檔」的完整流程確認可行——2026-08-20 完成，Phase E 全部收尾。
  - 對比度檢查：`npx vitest run` 45/45 通過（含 `storytellerContrastCheck.test.ts` 的兩個測試——文字/背景零失敗、已知失敗數量卡在 75 沒有增加，見上面「對比度檢查結果」小節）。
  - 完整鍵盤流程：用假登入機制在真實登入頁面（非 Playground）建立一個全新測試故事，走過「輸入標題／摘要 → 開始寫作 → 選取文字套用粗體 → slash 插入表格 → Tab 在儲存格間移動輸入內容 → slash 插入圖片（叫出資產選取 Dialog，Tab 正確到搜尋欄、Escape 正確關閉——沒有可用資產所以沒有實際插入一張圖片，上傳圖片本身這步驟需要真實檔案，跟大部分網站一樣依賴瀏覽器原生的檔案選取器，不算在「鍵盤操作編輯器本身」的稽核範圍內）→ 存檔」全流程，最後確認標題/摘要/段落/表格內容都正確存檔。
  - **自動化工具的已知限制（不是產品問題）**：測試過程中發現這個瀏覽器自動化工具沒辦法可靠送出「有 Modifier 鍵的組合鍵」（`Shift+方向鍵` 選取文字、`Cmd/Ctrl+B` 粗體快捷鍵、`Cmd/Ctrl+S` 存檔快捷鍵都試過，不管用 `cmd`／`ctrl`／`meta` 哪種 modifier 名稱送出，瀏覽器都只收到沒有 modifier 的單一按鍵，導致選取沒作用、`B`／`S` 被當成一般文字打進內容裡）——這是本次連續好幾輪修復都遇過的同一類已知限制的延伸（合成鍵盤事件對「瀏覽器/程式庫原生」行為不可靠，只有我們自己接的 command handler 才穩定收得到）。改用兩種方式間接驗證這些路徑本身沒問題：① 直接呼叫 `editor.commands.setTextSelection()`／`toggleBold()` 確認我們的擴充套件堆疊沒有攔截或搞壞這些操作；② 確認程式碼裡沒有任何自訂的 `Mod-b`／`Mod-i`／`Mod-u` 覆寫（`grep` 全 `wysiwygCore` 目錄零結果），粗體/斜體/底線快捷鍵完全吃 Tiptap 套件內建、久經測試的 `addKeyboardShortcuts()` 預設值；Ctrl+S 存檔快捷鍵的程式碼（`StoryEditor.tsx`/`LoreEditor.tsx` 的 `useEffect` keydown listener）是這次會話較早之前就寫好且審查過的簡單邏輯，非本次改動範圍。這幾個快捷鍵本身「按下去會不會動作」是瀏覽器原生 keydown 事件處理，不是自動化工具能穩定重現的範疇，但也不是這次 Phase E 稽核關心的「我們自己的程式碼有沒有跟鍵盤導覽互相干擾」的問題。

#### 對比度檢查結果（2026-08-19）

新增 [`storytellerContrastCheck.ts`](../../../static_site/src/data/storytellerContrastCheck.ts)（純函式：WCAG 相對亮度/對比度公式）＋ [`storytellerContrastCheck.test.ts`](../../../static_site/src/data/storytellerContrastCheck.test.ts)（`npx vitest run` 自動跑），涵蓋 11 色系 × light/dark ×（無節慶／中秋節）＝44 組 semantic token 組合，每組檢查四類：

- **文字/背景**（`textPrimary`／`textMuted` 對三種 surface）：**440 個檢查裡這類零失敗**，全部組合過 WCAG AA（4.5:1）。
- **按鈕**（MUI `contrastText` 自動判斷 vs `accentMain`）：✅ **已修（2026-08-20）**。原本大量失敗：MUI 沒有明講 `primary.contrastText` 時用 `contrastThreshold`（預設 3）自動選黑字/白字，比 WCAG AA 文字要求的 4.5:1 寬鬆；`accentMain` 是中亮度品牌色，很多色系兩種選擇都不夠格——這不是換個判斷邏輯能解的，是同一塊背景色沒辦法同時跟純黑、純白都達到 4.5:1，色彩學的硬限制。也試過乾脆拿 `accentMain` 本身當文字色（放棄整塊實色背景），結果發現這條路也不通：`accentMain` 疊在一般 surface 上當文字，22 組色系裡一樣有不過關的（bronze 淺色模式只有 2.66:1）。真正的解法是**不要整塊實色背景**：`storytellerComponentOverrides.ts` 新增 `accentTonalBackground()`，`MuiButton` 的 `containedPrimary` 改成 `color-mix()` 把 `accentMain` 用 30% 疊在 `surfaceRaised` 上（實測掃過 10%~40%，30% worst case 6.18:1，餘裕充足），文字固定用已證實「全部色系都過關」的 `textPrimary`，不是 `accentMain` 本身。視覺上是淡色調的「tonal」按鈕，不是原本飽和度很高的實色填滿。
- **選單 active 狀態**（`textPrimary` 對 `selection`）：✅ **已修（2026-08-20）**。原因跟按鈕類似——`selection`（`brassBright`）也是中亮度強調色，整塊實色背景 + 全彩文字對比常常不夠。同一招：`selectionStateLayer()` 用 `color-mix()` 把 `selection` 用 22% 疊在 `surfaceOverlay` 上（state layer 概念，worst case 6.56:1），不是整塊實色填滿；文字顏色不變。套用範圍：`MuiMenuItem` `.Mui-selected`（涵蓋右鍵選單／帳號選單等所有 MUI Menu）、`MuiAutocomplete` 的 `[aria-selected="true"]`、slash 選單自己手刻的選中狀態（`slashCommandExtension.tsx` 用同樣的 `color-mix()` 邏輯，沒有共用的 MUI theme 可以呼叫 helper，直接內嵌）。
- **focus ring**：
  - **已修**：中秋節 overlay 的 `focusRing` 原本淺色/深色模式共用同一組固定色值（`#f5cc6e`），淺色模式下對比度只有 1.0~1.3（實質看不見）——Root cause 是這組色值明顯只用深色模式肉眼看過，沒檢查過淺色模式。`storytellerSeasonalTheme.ts` 的 `overlayTokens` 改成分 `light`/`dark` 兩份，`mergeStorytellerSeasonalTokens()` 多一個 `mode` 參數；淺色模式的 `focusRing` 換成 `#6b4a1f`（11 色系淺色模式全部背景 worst-case 對比度 4.61:1，超過要求的 3:1 有餘裕）。已在瀏覽器驗證（`getComputedStyle` 讀 `--storyteller-focus-ring` 精確等於新值）。
  - **未修（已知，範圍很小）**：少數色系（brass／verdigris／bronze／malachite）淺色模式的 focusRing 沿用 `accentHover`，跟淺色 surface 對比不到 3:1——性質跟按鈕/選單不一樣，這是單一 token 數值需要重新選色（不是「整塊實色背景」這種用法問題），故意留到之後再處理。

**按鈕／選單 active 的驗證**：改動前後都跑過 `storytellerContrastCheck.test.ts`——已知失敗數量從 75 筆降到 10 筆（只剩上面的 focus ring 未修部分），按鈕跟選單 active 兩個類別在全部 44 組色系＋模式＋節慶組合下**零失敗**。瀏覽器實測（真實登入頁面，非 Playground）：`getComputedStyle` 確認「建立創作專案」按鈕背景是 `color-mix()` 疊色後的淡褐色（不是原本飽和度高的實色）、文字是 `textPrimary` 對應的深棕色；下拉選單選中項目背景讀出 `color(srgb ... / 0.22)`——精確等於 `selectionStateLayer(22)` 的 22% alpha，跟程式碼設計完全吻合；console 無新增錯誤。這兩類**不用重新設計 11 組色系的 token 數值**就解決了，跟原本評估「要嘛調色系、要嘛換視覺語言」的預期不同——實際做法是後者（換掉「整塊實色背景」這個用法本身），影響範圍小很多。

## 目前可觀察到的視覺變化（2026-08-18，給 Faryne 參考）

Phase A~D 做完後，Faryne 反映「除了少數地方，看不太出來有什麼特別的」——這其實符合預期：多數 Phase B/C 的改動是把原本就散落各處、剛好也接近的顏色**收斂成同一組 token 來源**（統一「以後只要改一個地方」），不是重新設計配色，所以肉眼不容易看出來；真正容易看出來的是**修掉的 bug**（原本某些字看不見）跟**layout／互動行為**的改動。以下只列有感的項目，不是全部改動：

- **首頁「已發佈的故事」卡片標籤**（例如「圖片／漫畫」「普通級」「限制級」）：中途曾經因為 Chip 換色出現白字配淺背景看不見的 bug，已修正；標籤背景/邊框現在統一走同一組 token。
- **存檔完成提示**（畫面右下角跳出的提示框）：同樣中途出現過白字看不見的 bug，已修正，現在看得到文字內容。
- **鍵盤 Tab 導覽的 focus 外框**：只用滑鼠不會看到——改用鍵盤 Tab 切換焦點到任何按鈕/連結時，外框顏色從瀏覽器預設藍色換成品牌金色，其餘完全不變。
- **工作台編輯器**（`/storyteller/my/workspace/...` 右欄的 Story／Lore／Image 編輯器）：
  - 標題／摘要／存檔按鈕那排改成 sticky 置頂，往下捲動長文時這排會一直留在畫面上方，不會被捲走。
  - 編輯框高度改成跟著視窗高度伸縮，寬螢幕桌機下方的留白變少。
  - 「存檔」按鈕滑鼠 hover 會跳出「快捷鍵：Ctrl+S／⌘S」提示。
- **Editor 內的浮動選單**（slash `/` 選單、選取文字後的 bubble menu、表格 bubble menu、右鍵選單）：四種選單背景色的「層次」現在統一（跟 Dialog／帳號選單同一階），之前 slash 選單顏色風格跟右鍵選單有落差（已知 Bug 記錄第 7 項），這批改完後應該看起來一致——但因為色調本身相近，需要把幾種選單並排比較才容易看出差異，不是那種一眼就發現「換了新色」的改動。
- **頁尾新增「中秋節」主題開關**（`SteamPaletteSwitcher` 色環正下方的按鈕）：**目前預設關閉**，點開後搜尋框輸入框 focus 邊框、選單選取色、focus 外框會變成月光金色調，其餘（AppBar、首頁 Hero 按鈕等）維持色系本色不變，是刻意的「淡妝」而不是整站變色。

**Phase E（無障礙功能 audit）已於 2026-08-20 全數完成**（見上面 Phase E checklist 逐項記錄），對比度／螢幕閱讀器狀態／鍵盤替代路徑都已審查或修正過；唯一刻意保留、還沒動的是按鈕/選單 active 狀態的色彩對比（需要重新設計 11 色系的按鈕/選單配色，Faryne 決定先跳過、review 完其他項目再回頭處理，見對比度檢查結果小節）。

## 工作階段與依賴順序

```
Phase A：Theme semantic token 整理
   ↓
Phase B：MUI components override（第一批：高曝光元件）
   ↓
Phase C：Editor 專屬操作 UI（slash/bubble/context/table/image menu）對齊同一套 token
   ↓
Phase D：節慶活動 overlay 機制
   ↓
Phase E：無障礙功能 audit／修正（Faryne 明確要求排最後）
```

前四個 Phase 彼此有依賴關係（B 需要 A 的 token、C 需要 B 定調的視覺方向、D 疊加在 A 的 token 系統上），E 之所以放最後不是因為不重要，是因為前面幾個 Phase 如果做得不小心（例如為了美觀拿掉 focus ring），反而會製造新的 a11y 債；把 a11y 排最後代表最後要做一次集中檢查跟補強，不代表前面可以隨便不管。

### Phase A：Theme semantic token 整理

**目的**：把現有 11 色系 × light/dark 的 raw token（`brass`／`copper`／`patina` 這種色系專屬名稱）,再包一層 semantic token，讓元件層不需要知道現在是哪個色系，只吃語意化名稱。

**建議的 semantic token 清單**（對應到現有 `StorytellerThemeTokens` 的欄位再擴充）：
- `storyteller.surface.base`／`storyteller.surface.raised`／`storyteller.surface.overlay`
- `storyteller.border.subtle`／`storyteller.border.strong`
- `storyteller.text.primary`／`storyteller.text.muted`
- `storyteller.accent.main`／`storyteller.accent.hover`
- `storyteller.focusRing`
- `storyteller.danger`
- `storyteller.selection`
- `storyteller.editor.paper`（編輯器紙面底色，可能跟一般 surface 不同）
- `storyteller.editor.menu`（slash/bubble/context menu 背景，跟一般 Dialog 背景可能不同層次）

**為什麼要多這一層**：Phase D 的節慶 overlay 需要「疊加」在現有色系上，如果元件都直接吃 `brass`／`copper` 這種色系專屬 token，節慶 overlay 沒辦法乾淨地只換 accent 色而不影響其他部分；先收斂成 semantic token，overlay 只要覆寫少數幾個 semantic key 即可。

**驗收方式**：不需要新增視覺，純粹是資料結構重構——跑現有 vitest／視覺快照（如果有）確認 11 色系 × light/dark 沒有任何顏色跑掉即可。

### Phase B：MUI components override（第一批）

**視覺方向**：**低調工業感，不要浮誇蒸汽龐克**。重點是邊框、surface 層次、hover/focus/active 狀態、陰影、圓角風格一致，不是到處加裝飾圖案。

**第一批涵蓋元件**（高曝光、最容易讓人感覺「跳出 storyteller 世界觀」）：
- `MuiDialog`／`MuiDialogTitle`／`MuiDialogContent`／`MuiDialogActions`——目標：像 storyteller 自己的面板，深淺 mode 都要有明確 border、title 區、footer 區區隔
- `MuiMenu`／`MuiMenuItem`／`MuiPopover`——目標：更像 editor command palette，不要像 MUI 白底下拉選單
- `MuiTooltip`——目標：小、暗、低陰影，跟編輯器浮動選單（bubble menu 等）視覺一致
- `MuiTextField`／`MuiOutlinedInput`／`MuiInputLabel`／`MuiFormHelperText`——目標：弱化 MUI 預設藍色 focus outline，改用 palette 的 accent／focusRing token
- `MuiButton`／`MuiIconButton`
- `MuiTabs`／`MuiTab`——目標：像文件分頁／面板切換，不要像 Material Design 的底線 tab
- `MuiDrawer`——目標：語法說明、設定類側邊面板改成 storyteller panel 風格

**第二批**（第一批做完、視覺方向確認沒問題後再補）：
`MuiSelect`／`MuiAutocomplete`／`MuiSwitch`／`MuiRadio`／`MuiCheckbox`／`MuiSnackbar`／`MuiAlert`／`MuiDivider`／`MuiChip`

**驗收方式（新增建議，降低 11 色系 × light/dark 的驗證成本）**：不需要每次改動都窮舉全部 22 種色系/模式組合人工檢查，那個成本太高。建議：
1. 挑 2~3 組「代表性」色系做視覺驗收即可，例如預設 `brass-dark`、對比度最極端的 `plainWhite-light`、`inkBlack-dark`，涵蓋亮/暗跟高低飽和度的極端案例。
2. 如果要更嚴謹，可以寫一支小 script（不用很複雜）跑過全部 22 組 token，用 WCAG 對比度公式檢查 text/background、focus ring/background 至少過 AA 標準，抓出來的異常再挑出來人工看，比全部肉眼看快很多且不會漏。這個 script 也可以留到 Phase E 一起做，不急著在 Phase B 就寫。

### Phase C：Editor 專屬操作 UI 對齊

Slash menu、Bubble menu、Context menu（[commands.ts](../../../static_site/src/pages/storyteller/wysiwygCore/commands.ts) 系列）、Table menu、Image settings dialog——這些原本就不是吃 MUI 元件的純手刻 DOM/React 元件，不受 Phase B 的 `components override` 影響，需要另外確認它們是不是吃到跟 Phase A 同一套 semantic token（現況是各自硬寫 `rgba(0,0,0,0.12)` 這類寫死的顏色，例如 `StorytellerWysiwygBubbleMenu.tsx`、`slashCommandExtension.tsx` 裡都有），這個 Phase 就是把這些硬寫的顏色抽換成 semantic token，讓自訂元件跟 MUI 元件視覺統一。

### Phase D：節慶活動 overlay 機制

**不建議**把節慶做成第 12、13、14…組獨立色系——會跟現有 11 色系 × light/dark 的組合數繼續爆炸相乘，維護成本太高。

**建議做成疊加層**：
```ts
base = storytellerThemeTokens[palette][mode]
seasonal = storytellerSeasonalOverlay[season]  // season = "none" 時整個 overlay 是空的
theme = mergeThemeTokens(base, seasonal)
```

節慶 overlay 只覆寫少數 semantic token 跟附加裝飾，**不觸碰**核心文字對比度、不改 danger/success 這類語意色：
- accent 色（例如情人節換成偏紅粉色調的 accent）
- 背景 subtle pattern／surface tint
- 少量裝飾性 asset（例如角落小圖案）
- 特定 header／banner／空狀態插圖
- button/menu hover 的微調

**觸發機制**（三層，第一版只需要做到第 2 層）：
1. 預設 `season: "none"`，不影響任何人
2. 使用者可在 palette switcher 附近手動選節慶主題／關閉，存 localStorage（跟現有 palette/mode 機制一致）
3.（可選，第一版可以不做）依日期自動建議套用，但不強制——例如情人節期間預設顯示提示，使用者仍可以關掉

**資料結構建議**：
```ts
interface StorytellerSeasonalTheme {
  id: "none" | "valentine" | "christmas" | "lunarNewYear" | ...;
  label: string;
  activeWindow?: { startMonthDay: string; endMonthDay: string }; // 給第 3 層用，第一版可省略
  overlayTokens: Partial<StorytellerSemanticTokens>;
  decorations?: { ... }; // 裝飾性 asset 路徑，第一版可以先留空
  canAutoActivate: boolean;
}
```

**第一版範圍建議**：先做機制本身 + 1 個示範節慶（例如聖誕節，時間點離規劃日較近，也比較好抓裝飾素材），不要一次把情人節/聖誕節/其他節慶全做完；機制驗證過沒問題，之後加新節慶只是加資料、不用再動架構。

**重要原則**：節慶 layout 不應該大改資訊架構或導覽方式，只是「故事頁穿上節慶外衣」，不是每逢節慶就變成不同產品。

### Phase E：無障礙功能 audit／修正（排最後）

**為什麼排最後**：Faryne 自己也提到「可能會跟既有很多功能相衝突」——編輯器的互動核心（slash command、bubble menu、右鍵選單、表格 cell 選取、圖片版面控制）都是高複雜度的即時互動邏輯，貿然做 a11y 大改容易把 Phase 9 才驗收過的功能又打開重測。排最後代表：前面幾個 Phase 過程中不要**製造新的** a11y 債（例如不能為了美觀拿掉 focus-visible outline），但完整、系統性的 a11y 檢查跟修正集中在這個 Phase 做。

**高風險區（Codex 盤點）**：
- **Slash command**：鍵盤導覽、IME 組字期間的按鍵攔截、Escape/Enter 語意、`aria-activedescendant` 需要補
- **Bubble menu**：選取文字時才出現的浮動選單，螢幕閱讀器不一定容易理解目前狀態
- **右鍵選單**：mobile 完全沒有右鍵手勢，keyboard-only 使用者也叫不出來，需要確認有沒有替代入口
- **表格 cell 選取**：ProseMirror 的 table selection 機制跟一般 keyboard navigation 容易衝突
- **圖片版面控制**：NodeSelection、圖片設定 dialog、右鍵入口，都需要有鍵盤可達的替代路徑
- **Dialog focus trap**：只要 Phase B 沒有自己重刻 Dialog 行為（維持吃 MUI 元件、只換皮），這塊風險本來就低，MUI 本身有處理好
- **色彩對比**：11 色系 × light/dark ×（之後）節慶 overlay，組合數多，contrast 測試量會隨之增加——建議用 Phase B 提到的自動化對比度檢查 script，不要全部肉眼過

**降低風險的做法**：
- 整個規劃過程都不自己重刻 Dialog／Menu 的互動邏輯，維持吃 MUI 元件本體，只換 `styleOverrides`——這樣 focus trap／keyboard／ARIA 這些困難的部分完全不用碰
- 所有 command 都要能透過鍵盤到達，不能只靠右鍵這一種入口（這點其實在 Phase 6 拔工具列時已經是既有原則，Phase E 只是系統性驗證有沒有漏網之魚）
- 對 slash／bubble／context menu 補齊明確的 `aria-label`／`role`
- focus ring 不能為了美觀被拿掉，只能換成 storyteller 風格的視覺（例如換色但保留清楚的輪廓）
- palette／seasonal overlay 要過對比度檢查，至少涵蓋：文字/背景、按鈕、menu active 狀態、focus ring 這四類
- 建議在 Phase 9（[所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md)）人工測試全部跑完之後才開始，不要跟視覺換皮同時進行，避免功能問題跟視覺 regression 混在一起難以排查

### Phase F：閱讀頁版面比照工作台（2026-08-17 新增，範圍跟時程都還沒定）

**起因**：Phase 8.1.3 圖片尺寸 preset 做完後，Faryne 拿編輯頁跟閱讀頁的截圖比對，發現同一張圖片在兩邊呈現的比例不一致（詳細診斷過程見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 10 項）。查到 root cause 是編輯器內文欄寬（實測 1676px）跟閱讀頁內文欄寬（實測 902px，且不是刻意設計的常數，只是側邊欄佔掉之後剩下的空間）差了將近兩倍。圖片比例的問題本身已經用「size preset 拿掉 px 上限、改純百分比」解掉，但過程中討論出一個更大的產品目標：

> 身為創作者，看到編輯器呈現的樣子是自己想要的，會直覺預期閱讀頁也要有一樣的效果——這是 WYSIWYG 編輯器的核心承諾，不該只有圖片比例一致，應該是整體版面觀感一致。

Faryne 具體提出的方向：**把閱讀頁的側邊欄／內文寬度比例，比照工作台（編輯頁）的側邊欄／編輯區比例**，而不是各自獨立設計。

**為什麼不是這次一起做**：查過現況，工作台（`WorkspaceChrome.tsx`）跟閱讀頁（`Reader.tsx`）的側邊欄／內文寬度是兩份各自獨立刻出來的 flex 排版，沒有共用任何寬度常數或 layout 元件。要讓兩邊「比例一致」，不是調一兩個數字就好，而是要把兩份獨立長出來的版面邏輯收斂成一套共用規則——這個工作量級接近本文件 Phase A~E 在做的事（產品視覺一致性），不是圖片比例這種單點修復能夠一起處理的。

**已經討論過、決定不採用的替代方案**（記錄下來避免以後重複討論一次）：
- 直接把閱讀頁改成跟工作台一樣全出血寬度——會讓閱讀頁的每行文字過長，犧牲讀者（不是作者本人）的閱讀舒適度，閱讀頁是最直接面向讀者的頁面，不該為了作者端的觀感一致而犧牲讀者體驗，兩人討論後排除這個方向。

**範圍待釐清（真的要做的時候再細part，這裡先列出需要想清楚的問題）**：
- 「比例一致」的目標定義：是側邊欄／內文的絕對寬度一致，還是彼此的「比例關係」一致（例如工作台側邊欄佔 20%、閱讀頁側邊欄也佔 20%，但兩邊總寬度可以不同）？
- 閱讀頁目前的內文欄寬雖然不是刻意設計的常數，但客觀上落在適合長文閱讀的範圍——如果收斂版面邏輯的結果會讓閱讀頁內文變寬，要重新評估會不會傷害閱讀體驗，不能為了「跟編輯器一致」犧牲這一點
- 側邊欄的收合／展開行為（工作台跟閱讀頁的側邊欄目前互動邏輯本來就不一樣：一個是專案/作品/設定集樹狀導覽，一個是目錄/書籤/大綱）要不要也一併統一，還是只統一寬度數字、互動邏輯維持各自設計
- Mobile 斷點下兩邊本來就會退回單欄，這個目標主要影響桌面/平板寬度的呈現

**狀態**：僅記錄方向與待釐清問題，尚未排時程、尚未細part工作項目，等前面幾個 Phase 有進度後再回頭評估。

### Phase G：圖片相關問題集中處理（2026-08-17 新增，從 Phase 9.5／9.6 人工測試移過來）

Faryne 完成 Phase 9.5／9.6 人工測試後，覺得圖片相關的問題有點多、不要每次一個一個修，決定統一挪到這裡集中處理，等真的要動的時候一起排。跟這份文件其他 Phase 不同的是：**這幾項是功能性的互動 bug，不是視覺樣式問題**，只是因為都跟圖片有關、且時間點上想跟 createTheme 一起排，所以放在同一份文件追蹤，不代表都要用 theme override 的方式解決。

已知項目（都還沒查 root cause，只記錄現象）：

1. ~~**圖片後面接「引用」會跟圖片重疊**~~ ✅ **Faryne 複測確認已隨項目 5 的其他修正一併解決（2026-08-18）**——插入引用會正確跳到圖片下方，不再重疊，`CLEAR_FLOATING_ASSET_SX` 的 `clear:both` 本身沒問題。過程中連帶挖出一個新問題：見項目 5 延伸的「已知 Bug 記錄」第 15 項（空白引用/清單行按 Backspace 沒有跳出格式）。
2. ~~**圖片置中時，焦點在圖片上按 Enter 不會斷行**~~ ✅ **已修（2026-08-18）**。實際現象比原記錄更明確：不是「沒反應」，是方向反了——會在圖片**上面**插入新段落，不是下面。Root cause／解法／驗證方式詳見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 13 項；簡述：`markerParagraph.ts` 的 `Enter` handler 沒檢查 `NodeSelection`，直接拿 `$from` 位置去分割——但 NodeSelection 的 `$from` 落在節點「前面」，分割出來的新段落自然排到圖片上面。加了 `NodeSelection` 分支，改成在圖片所在段落之後插入新段落。
3. ~~**圖片置中/全寬後，緊接著用 slash 插入分隔線，圖片會消失/被吃掉**~~ ✅ **已修（2026-08-18）**。Root cause／解法／驗證方式詳見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 12 項；簡述：`isTextOnlySlashQuery` 的文字比對沒把圖片這種 inline atom 算進去，誤判「游標緊接圖片後面」跟「段落是空的」一樣，讓 slash 選單在不該出現的地方跳出來，`insertHorizontalRule` 又會把「目前段落」內容整個刪掉——兩層都修了（slash 選單源頭擋掉＋`insertHorizontalRule` 改成搬移保留內容，不再直接刪除）。
4. ~~**插入資產功能加說明文字欄位，並在閱讀頁顯示**~~ ✅ **已修（2026-08-19）**。新增獨立的「圖說」欄位（`caption`），跟「替代文字」（`alt`，無障礙/SEO 用）完全分開存放、分開顯示。
   - **儲存格式**：Storyteller 文章內容存的是 markdown 字串，不是 JSON schema，圖片語法是 `![alt](src "layout=xxx size=yyy")`。`caption` 比照 `layout`/`size` 塞進同一個 title 字串，但值是自由文字（可能有空白、中文），跟 `layout`/`size` 的固定列舉值不同，所以用 `encodeURIComponent` 編碼成 `caption=xxx`，避免破壞 title 字串以空白分隔 token 的解析方式；`whitelist.ts` 的 `assetImageTitleValue()` 內部比對值的正則也從只認 `[A-Za-z0-9-]+` 放寬成 `\S+`，才能吃到編碼後的字元集（layout/size 的值域本來就是子集，行為不變）。留空則整個 `caption=` 都不輸出，舊資料/沒填圖說的圖片語法不受影響。
   - **改動檔案**：`whitelist.ts`（新增 `assetImageCaptionFromTitle()`）、`assetImageLayout.ts`（`assetImageTitle()` 加第三個參數）、`parser.ts`（`ParsedRun` 新增 `assetCaption`，解析/組回 Tiptap JSON 兩處都接上）、`serializer.ts`（序列化回 markdown 時輸出 `caption=`）、`assetImageNode.tsx`（node 新增 `caption` attr，Dialog 加「圖說」多行輸入框，NodeView 在圖片下方用斜體置中文字顯示）、`StorytellerWysiwygMarkdown.tsx`（閱讀頁 `renderRun()` 在圖片下方同樣顯示圖說文字，這是閱讀頁第一次真的顯示圖片相關的可見文字，之前只有 `<img alt>` 屬性，畫面上看不到）。**後端／DB 不需要改動**——Go 後端只存整段字串，不解析圖片語法內容。
   - **驗證**：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。Playground 實測：帶 `caption=` 的 markdown 貼進去，編輯器 NodeView 跟 Reader preview 都正確顯示圖說文字；透過 Dialog 修改圖說後套用，重新讀 raw content textarea 確認序列化字串裡的 `caption=` 值正確更新（URI 編碼往返一致）；沒有 `caption` 的圖片語法序列化後跟輸入前逐字元相同，沒有多長出空的 `caption=` 片段，確認舊資料不受影響。
5. ~~**游標在圖片後面第一行文字開頭按 Backspace，會直接把圖片整個刪掉**~~ ✅ **已修（2026-08-18，過程中修正過一次誤判）**。Faryne 實測發現：行為上「合理」，但沒有給使用者反悔的機會，一按就整張圖不見。**第一版修法在 Playground 測試中看似成功，但 Faryne 在真實頁面複測完全無效**——靠 Faryne 提供的 console debug log 才抓到真正原因：圖片跟後面的文字其實是**同一個段落**（float 環繞排版時圖片是段落最前面的 inline atom），不是「圖片獨占一個段落、文字是下一個段落」，第一版的判斷式完全沒涵蓋這個情境。改成同時檢查「游標前面在同段落內是不是緊接著 atom」跟「游標在段落開頭時前一個獨立段落是不是單一 atom」兩種情境，第一次 Backspace 都只轉成選取狀態，不刪除。詳見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 14 項——**驗證仍有缺口**：這次改用正確重現的「同段落」情境驗證，第一次 Backspace（選取而不刪除）確認通過；第二次 Backspace（選取狀態下再刪除）一樣沒辦法在自動化環境裡觸發成功，懷疑是工具限制（`deleteSelection` 是完全沒被這次改動碰到的 ProseMirror 內建邏輯），麻煩 Faryne 之後在真實瀏覽器手動確認第二次 Backspace，也麻煩優先確認這次修正過的「同段落」情境是否真的解決了。

6. ~~**游標在表格內按 Enter 完全沒反應**~~ ✅ **已修，但方案後來被項目 7 取代（2026-08-18）**。一開始的折衷方案是「只有游標在最後一個 cell 尾端時 Enter 才斷行」，等項目 7 補上 grip handle（選取整個表格的手勢）之後，Faryne 指出兩條路徑並存會讓規則不一致，這個折衷方案已經拿掉——現在表格 cell 內按 Enter 統一「什麼都不做」，斷行只透過項目 7 的「grip 選取整個表格 → Enter」。詳見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 19／20 項。
7. ~~**表格缺少「選取整個表格」的手勢**~~ ✅ **已修（2026-08-18，跟 Codex 討論設計後實作）**——第 6 項討論時發現的缺口：圖片可以直接點一下選取整個節點（`contenteditable=false`），表格沒有對應的東西。找 Codex 討論了幾個方案（左上角 grip handle／點表格外框邊界／用 `CellSelection` 涵蓋全部 cell 模擬），Codex 建議 grip handle 加上表格外掛的 `allowTableNodeSelection` 選項，點表格外框邊界的方案因為跟現有 cell 拖曳判定／未來欄寬調整熱區衝突風險高而不採用，涵蓋全部 cell 的 `CellSelection` 也不建議直接當「整張表格」的替代狀態（Backspace/Copy 在 `CellSelection` 語意下的預設行為偏向清空/走 cell-level slice，要對齊「整張表格」的意圖得寫一堆特判）。
   - **實作**：`storytellerTable.ts` 的 `StorytellerTable` 節點改用 `addNodeView()`，在 `<table>` 外面包一層 `.storyteller-table-wrapper`，左上角放一顆 `.storyteller-table-grip` 按鈕，`mousedown` 時直接 dispatch `NodeSelection.create(doc, tablePos)`；`tableEditing()` 加上 `allowTableNodeSelection: true`（沒開的話外掛會把 table 的 `NodeSelection` 正規化回涵蓋全部 cell 的 `CellSelection`，grip 點了等於沒用）。選到後的視覺回饋沿用圖片節點同一組 `selection` semantic token（金色 outline 光暈），CSS 寫在 `StorytellerWysiwygEditor.tsx`。
   - **選到表格之後**：Backspace 走 ProseMirror 對 `NodeSelection` 的預設 `deleteSelection`（跟圖片「選取狀態下第二次 Backspace 會刪除」是同一套機制，Faryne 已經確認圖片那條路徑沒問題），這部分真的不用額外寫。Enter 原本預期直接吃 `markerParagraph.ts` 既有的「`NodeSelection` 就在節點後面插入新段落」通用邏輯就好，但實測完全沒反應——挖出一個真正的 bug：那段邏輯用 `$from.after($from.depth)` 算插入位置，圖片是巢狀在段落裡的 inline atom（`depth` 至少 1）沒問題，但表格是直接掛在文件最上層的 block 節點（`depth` 是 0），`$from.after(0)` 會拋出 `RangeError: There is no position after the top-level node`，例外被外層 keymap 悄悄吞掉，Enter 才會看起來像沒反應。改用 `selection.to`（`NodeSelection` 自帶的節點結束位置，單純位置加總，不管巢狀深度都成立）取代，圖片跟表格才都正確。順便把第 6 項的折衷方案（最後一個 cell 尾端才斷行）拿掉，統一只靠 grip 選取後 Enter 斷行。詳見所見即所得編輯器notion-like分析_定案版.md 第 20 項的完整記錄。
   - **驗證**：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。Playground 驗證：點擊 grip 按鈕後 `editor.state.selection` 確認是真正的 `NodeSelection`（`node.type.name === "storytellerTable"`），DOM 上 wrapper 出現 `.ProseMirror-selectednode` 且金色 outline 正確顯示；選到表格後按 Enter，確認表格後面正確插入新段落；選到表格後按 Backspace，確認整張表格（連同 wrapper）被刪除，只剩前後段落；一般 cell 內打字的既有行為沒有回歸。

**驗證方式更新（2026-08-18）**：這幾項原本被認為「只能在真實登入頁面手動確認」，卡住 Faryne 需要陪同逐一檢查。後來發現 `/storyteller/wysiwyg-demo` Playground（dev-only、免登入，掛的是正式 `StorytellerWysiwygEditor`）就能拿來程式化重現／驗證這類編輯器互動 bug：用瀏覽器 JS 直接操作原始內容 textarea 設初始狀態、`dispatchEvent` 觸發選單裡的 command 按鈕，或透過 `document.querySelector('.tiptap.ProseMirror').editor` 直接拿到 Tiptap `editor` 物件呼叫 `editor.commands.setTextSelection(pos)`／`setNodeSelection(pos)` 精準定位游標（比滑鼠點擊座標換算可靠很多），不需要真人手動點擊或登入。

**狀態**：全部 7 項都已完成（項目 1 是項目 5 的副作用一併解決；過程中挖出新的已知 Bug 第 15 項——空白引用/清單行按 Backspace 沒有跳出格式，已修但「跳出格式後的合併」待人工複測）。項目 4（圖說欄位）2026-08-19 完成，是唯一的功能請求，其餘都是 bug 修正。

## 結論

這件事值得做，方向是**用 MUI 的 theme override 機制把 storyteller 的互動元件視覺收斂成一套產品自己的語言，而不是移除 MUI 或重刻一套 UI framework**。現有的明暗模式跟色系切換基礎設施已經很完整，真正要做的工作集中在 Phase A（token 整理）跟 Phase B（component override），這兩個做完視覺落差感就會大幅改善；Phase C／D／E 可以視時間陸續往後排，彼此依賴關係已經在上面列清楚。

第一版目標建議只寫到「storyteller 的操作 UI 不再像 MUI 預設樣式」，不要一開始就想著要做完整設計系統或節慶活動系統——每個 Phase 都可以獨立驗收、獨立上線，不需要一次全部做完。

# Storyteller 客製視覺主題規劃（以 createTheme 為基礎）

2026-08-17 由 Faryne 提出、Claude／Codex 討論收斂。**這份文件只做規劃，不動 code**——Faryne 要等 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的 Phase 9 人工驗收跑完後才會安排時間處理，避免視覺改動跟功能驗收混在一起。

## 背景與範圍決定

起因是 Faryne 問「這個編輯器如果不用 MUI、改客製設計語言，效益/成本/風險如何」。討論過程（詳見對話紀錄，不重複列在這裡）收斂出幾個關鍵結論：

1. **不整站換掉 MUI**，只針對 storyteller 這條產品線——因為 storyteller 已經有自己風格明確的 Steam 齒輪／黃銅 layout，但 Dialog／Menu／TextField 這些互動元件還是 MUI 預設樣式，會有「世界觀外物件」的割裂感；其他子站沒有這個問題，不需要跟著換。
2. **不移除 MUI，只換皮**：MUI 底層的 focus trap、keyboard navigation、ARIA、portal stacking、mobile 行為都是成熟、踩過坑的東西，自己重刻風險高、效益低。真正該做的是用 MUI 的 `createTheme` + `components` overrides 機制，把這些元件的視覺跟狀態語言換成 storyteller 自己的風格，行為邏輯完全不動。
3. Storyteller 頁面裡最需要處理的高用量互動元件（`src/pages/storyteller/*.tsx` + `wysiwygCore/*.tsx` 統計）：Tooltip 216、MenuItem 159、TextField 121、Dialog 60（Title/Content/Actions 各約 50）、Menu 36、Tab 17／Tabs 15、Drawer 12。真正「貴」的不是視覺本身，是這些元件背後的互動邏輯，所以維持 MUI 元件、只套 theme override，是成本效益最好的做法。

## 現況盤點（開始規劃前務必先確認，很多基礎其實已經做好了）

- `src/layouts/StorytellerLayout.tsx` 已經有 `createTheme()`，套用 `storytellerThemeTokens[palette][mode]`，包含 `palette`／`shape.borderRadius`／`typography`。**目前完全沒有 `components:` overrides**——Dialog／Menu／TextField／Tabs／Drawer 這些元件的邊框、圓角、陰影、hover/focus 狀態，全部還是 MUI 原生樣式，只有顏色跟字體吃到 storyteller 的 token。
- **明暗模式已經做好**：`mode: "light" | "dark"`，由 `StorytellerThemeModeContext`（[storytellerThemeMode.tsx](../../static_site/src/layouts/storytellerThemeMode.tsx)）管理，存 localStorage，預設跟隨系統 `prefers-color-scheme`，UI 上有切換按鈕（`StorytellerLayout.tsx` header）。
- **色系切換已經做好**：`src/data/storytellerTheme.ts` 定義了 11 組色系（brass／bronze／malachite／verdigris／steel／cobalt／violetCopper／roseCopper／inkBlack／silver／plainWhite），每組都有 light/dark 兩份 token（brass/copper/patina/ember/bg/surface/surfaceRaised/border/borderStrong/text/textMuted），由 `SteamPaletteSwitcher` 元件切換，存 localStorage。
- **節慶活動主題完全沒有**：程式碼裡搜不到任何 seasonal/holiday 相關機制。
- **無障礙功能幾乎沒有專門處理**：只有 `PublicHome.tsx` 有一點點，editor／reader 相關頁面沒有系統性處理過。

所以 Faryne 列的四個工作項裡，「明暗變化」「色系變化」的**資料層**已經有了，缺的是**套用範圍**——目前這層 theme 只影響顏色跟字體，元件的結構性樣式完全沒動過。

**2026-08-17 更新**：Faryne 在 Phase 9.1 案例 3 實測發現右鍵選單跟 slash 選單顏色風格不一致（root cause 跟修法見 [所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) 的「已知 Bug 記錄」第 7 項），Faryne 認為 createTheme 施作時間還沒定，這個具體 bug 不該卡在後面，已經提前處理掉了：`StorytellerLayout.tsx` 的 `createTheme()` 已經開了 `cssVariables: true`（MUI 會把 palette 同步成 `--mui-palette-*` CSS variables），slash 選單也已經改吃這些變數。這代表 Phase A／B 開始時，`cssVariables` 這個底層開關已經不用再開一次，可以直接沿用；`slashCommandExtension.tsx` 也已經是一個「手刻 DOM 吃 CSS variables」的參考範例，Phase C 要處理 bubble menu／table menu／context menu 時可以照抄同樣的模式。

## 工作 Checklist（2026-08-17 新增，實際施作用）

Faryne 確認後才開始動工。每個 Phase 完成一個項目就打勾，一個 Phase 全部打勾後 commit 一次（不是每個 checkbox 都各自 commit）——跟這份文件其他地方一樣，勾了才代表真的做完＋驗證過，不是「打算做」。範圍只到 Phase A~E（實際 createTheme 視覺工作）；Phase F（閱讀頁版面比照工作台）跟 Phase G（圖片相關功能性問題）都還沒排定範圍/時程，不在這次施作範圍內，不會出現在下面的 checklist 裡。

### Phase A：Theme semantic token 整理 ✅ 已完成（2026-08-17）
- [x] 在 `storytellerTheme.ts` 或新檔案定義 semantic token 型別（`storyteller.surface.base/raised/overlay`、`border.subtle/strong`、`text.primary/muted`、`accent.main/hover`、`focusRing`、`danger`、`selection`、`editor.paper`、`editor.menu`）——新增獨立檔案 [storytellerSemanticTheme.ts](../../static_site/src/data/storytellerSemanticTheme.ts)（不是塞進已經 450 行的 `storytellerTheme.ts`），定義 `StorytellerSemanticTokens` 介面，14 個 key 都照規劃列的名字
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
- [x] 驗證：新增 [storytellerComponentOverrides.ts](../../static_site/src/data/storytellerComponentOverrides.ts)，接上 `StorytellerLayout.tsx` 的 `createTheme({ components: storytellerComponentOverrides() })`。全部用 `var(--storyteller-*)` 字串字面值（跟 slash menu 同模式），不用重新算 `[mode, palette]`。`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。

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
- [x] 定義 `StorytellerSeasonalTheme` 型別跟資料結構——新增 [storytellerSeasonalTheme.ts](../../static_site/src/data/storytellerSeasonalTheme.ts)，`StorytellerSeasonalOverlayTokens` 刻意用 `Pick` 限定只能覆寫 `accentMain`／`accentHover`／`focusRing`／`selection`／`borderStrong` 這五個裝飾性 key（型別層級擋住，不是靠口頭約定），`activeWindow`／`decorations` 兩個第一版用不到的欄位如規劃保留但不強制填
- [x] 實作 `base + seasonal overlay` 的 merge 邏輯——`mergeStorytellerSeasonalTokens(base, seasonId)` 用 `{ ...base, ...overlayTokens }`，`season: "none"` 對應的 `overlayTokens` 是空物件，回傳值在數值上等於 base 本身
- [x] UI：新增 [SteamSeasonalSwitcher.tsx](../../static_site/src/components/storyteller/SteamSeasonalSwitcher.tsx)，放在 `SteamPaletteSwitcher` 正下方（`StorytellerLayout.tsx` 頁尾），點節慶按鈕＝切換 active/inactive（再點一次已啟用的節慶＝關掉，不需要另外一顆關閉鈕）；新增 [storytellerSeasonalMode.tsx](../../static_site/src/layouts/storytellerSeasonalMode.tsx) 提供 Context＋localStorage 存取，完全比照既有 `storytellerPaletteMode.tsx`／`storytellerThemeMode.tsx` 的寫法（同一套「未選過或存的值不合法時退回預設」邏輯）
- [x] 示範節慶：中秋節（Faryne 指定，不是文件原本建議的聖誕節）。`accentMain #e6b143`／`accentHover #f5cc6e`／`focusRing #f5cc6e`／`selection #f0c26a`／`borderStrong #8a6a3a`，月光金色調，比預設 brass（`#c9974f`）更亮更黃；只動這五個 key，不碰 `surfaceBase`／`textPrimary`／`textMuted`，也不去動 danger（MUI severity 色系是元件層自己決定，不歸這層管）
- [x] 驗證：`npx tsc -b --noEmit` 乾淨、`npx vitest run` 43/43 通過。瀏覽器實測（brass-dark）：切到「中秋節」後 `getComputedStyle(document.documentElement)` 讀出的 5 個 `--storyteller-*` 變數精確對上 overlay 設定值；`/storyteller` 公開首頁搜尋框 focus 邊框從 `rgb(201,151,79)`（brass accentMain）變成 `rgb(230,177,67)`（中秋 accentMain）；AppBar／首頁 Hero 按鈕等直接吃 `theme.palette.primary`（＝ `tokens.brass`，不經過 semantic 層）的地方顏色不變，符合「只換裝飾性強調色，不是整站變色」的設計；關閉節慶後 `localStorage` 存回 `"none"`、`accentMain` 精確回到 brass 原值 `#c9974f`，畫面截圖確認首頁視覺跟切換節慶前逐位元一致。**Faryne 要求的收尾動作已完成**：實測完把節慶切回「無」（`none`），commit 送出時預設狀態是關閉的，不影響任何既有使用者。

### Phase E：無障礙功能 audit／修正
- [ ] Slash command：鍵盤導覽、IME 組字期間按鍵攔截、Escape/Enter 語意、補 `aria-activedescendant`
- [ ] Bubble menu：確認螢幕閱讀器能理解目前狀態（選取文字後浮動選單出現這件事本身要能被輔助技術偵測到）
- [ ] 右鍵選單：確認 mobile／keyboard-only 情境下有替代入口能做到同樣的事（不能只靠右鍵這一種入口）
- [ ] 表格 cell 選取：確認 ProseMirror table selection 機制跟一般 keyboard navigation 沒有互相干擾
- [ ] 圖片版面控制：NodeSelection、圖片設定 dialog、右鍵入口都要有鍵盤可達的替代路徑
- [ ] 寫一支對比度檢查 script，跑過全部色系組合（11 色系 × light/dark，若 Phase D 已完成則含節慶 overlay），檢查文字/背景、按鈕、menu active 狀態、focus ring 至少過 WCAG AA
- [ ] 對 slash／bubble／context menu 補齊明確的 `aria-label`／`role`
- [ ] 驗證：跑過對比度檢查 script 沒有異常；鍵盤（不用滑鼠/觸控）走過一次「開始寫作 → 套用格式 → 插入表格/圖片 → 存檔」的完整流程確認可行

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

Slash menu、Bubble menu、Context menu（[commands.ts](../../static_site/src/pages/storyteller/wysiwygCore/commands.ts) 系列）、Table menu、Image settings dialog——這些原本就不是吃 MUI 元件的純手刻 DOM/React 元件，不受 Phase B 的 `components override` 影響，需要另外確認它們是不是吃到跟 Phase A 同一套 semantic token（現況是各自硬寫 `rgba(0,0,0,0.12)` 這類寫死的顏色，例如 `StorytellerWysiwygBubbleMenu.tsx`、`slashCommandExtension.tsx` 裡都有），這個 Phase 就是把這些硬寫的顏色抽換成 semantic token，讓自訂元件跟 MUI 元件視覺統一。

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

1. **圖片後面接「引用」會跟圖片重疊**——[所見即所得編輯器notion-like分析_定案版.md](所見即所得編輯器notion-like分析_定案版.md) Phase 9.6 實測發現，圖片文繞圖時如果緊接著一個引用區塊，畫面會跑版/疊在一起。懷疑方向：`CLEAR_FLOATING_ASSET_SX`（[assetImageLayout.ts](../../static_site/src/pages/storyteller/wysiwygCore/assetImageLayout.ts)）目前設定 `clear:both` 的選擇器是 `& h1~h6, & [data-block-kind], & table, & [data-asset-layout]`，還沒實際確認引用區塊的 DOM 結構有沒有被這個選擇器涵蓋到。
2. **圖片置中時，焦點在圖片上按 Enter 不會斷行**——NodeSelection（選到圖片本身）狀態下按 Enter 沒有反應，預期應該要跟 Notion 一樣，在圖片後面插入一個新段落。
3. **圖片置中/全寬後，緊接著用 slash 插入分隔線，圖片會消失/被吃掉**——但如果先斷一行、隔一行再用 slash 插入分隔線就正常。懷疑跟 slash command 的 range 計算或分隔線插入邏輯在緊鄰 atom node（圖片）時的位置判斷有關，還沒深入查。這個算是比較明確的資料完整性風險（圖片內容不見了），三項裡優先度應該最高。
4. **插入資產功能加說明文字欄位，並在閱讀頁顯示**——這是功能請求，不是 bug。目前圖片只有「替代文字」（`alt`，主要給無障礙/SEO 用），Faryne 想要一個給讀者看的「圖片說明」欄位，類似圖說/caption 的概念，跟 `alt` 是不同用途、不應該共用同一個欄位。

**狀態**：僅收斂記錄現象，尚未排優先序、尚未查 root cause，等真的要處理時再展開。

## 結論

這件事值得做，方向是**用 MUI 的 theme override 機制把 storyteller 的互動元件視覺收斂成一套產品自己的語言，而不是移除 MUI 或重刻一套 UI framework**。現有的明暗模式跟色系切換基礎設施已經很完整，真正要做的工作集中在 Phase A（token 整理）跟 Phase B（component override），這兩個做完視覺落差感就會大幅改善；Phase C／D／E 可以視時間陸續往後排，彼此依賴關係已經在上面列清楚。

第一版目標建議只寫到「storyteller 的操作 UI 不再像 MUI 預設樣式」，不要一開始就想著要做完整設計系統或節慶活動系統——每個 Phase 都可以獨立驗收、獨立上線，不需要一次全部做完。

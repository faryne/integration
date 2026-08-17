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

## 結論

這件事值得做，方向是**用 MUI 的 theme override 機制把 storyteller 的互動元件視覺收斂成一套產品自己的語言，而不是移除 MUI 或重刻一套 UI framework**。現有的明暗模式跟色系切換基礎設施已經很完整，真正要做的工作集中在 Phase A（token 整理）跟 Phase B（component override），這兩個做完視覺落差感就會大幅改善；Phase C／D／E 可以視時間陸續往後排，彼此依賴關係已經在上面列清楚。

第一版目標建議只寫到「storyteller 的操作 UI 不再像 MUI 預設樣式」，不要一開始就想著要做完整設計系統或節慶活動系統——每個 Phase 都可以獨立驗收、獨立上線，不需要一次全部做完。

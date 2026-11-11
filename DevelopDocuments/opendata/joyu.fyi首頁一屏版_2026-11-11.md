# joyu.fyi 首頁一屏版（可切換新舊版面）

> 狀態：已實作（branch `feat/joyu-home-compact`），未 commit
> Mockup：`DevelopDocuments/opendata/joyu-home-fold-mockup/index.html`

## 目標

主要區塊（今天有新片的女優、新片、近期生日、女優主題）不用捲動就看得到：

- 1366×768 筆電（可視約 668px）
- iPhone（可視約 390×664）

原版面保留，首頁可以切換，並記錄使用者評分。

## 版面

- **PC（md 以上）**：
  - 頂端：小 Hero Card（深紫底，`JoyuSearchBox` 的 `dense` 精簡搜尋框＋一排主題捷徑 chip），右邊是評分＋新版／原版切換。
  - 左欄：今天有新片的女優（一排，卡寬 96）→ 新片（分頁＋一排封面，寬 118、標題 1 行）→ 728 版位（home-1）。
  - 右欄 320：近期生日（條列 6 位）→ 女優主題（chip 14 個）→ 300×100 版位（home-2，固定手機尺寸）。
- **手機**：
  - 單欄，每區一排橫向滑動：女優卡 72、封面 88 只留番號、生日頭像 40、主題 chip 不換行。
  - 728 版位不渲染。用 `display:none` 藏起來還是會在背景載廣告、算成無效曝光，所以改成用 `useMediaQuery` 判斷要不要渲染。
  - 評分＋切換放在最下面；放上面會把女優主題擠出第一屏。
- 「你追蹤的女優新片」在新版併進新片區塊，當第一個分頁「追蹤的女優・7 天 N」。有登入且有新片時預設停這頁，「看全部」到我的追蹤。原版仍是獨立區塊。
- 小 Hero Card 沒有標題字，補了一個視覺上隱藏的 `h1`（找女優、查番號）給 SEO 與螢幕閱讀器。
- 這個版面以 PC 為主（使用者 2026-11-11 確認）：手機不放 Hero Card，手機的第一屏不再刻意調整。

## 切換與評分

- 版面記在 localStorage `joyu.home-layout`（`compact`／`classic`），預設 `compact`。
- 評分：用共用元件 `components/common/ScoreRating.tsx`（`titleText`、`onScore(score: number)`，選填 `precision`、`thanksText`），評完自己收起並跳「謝謝評分」。
  - 「每個版面在同一台瀏覽器只問一次」由使用處判斷：`joyu.home-layout-rated.<layout>` 有值就不渲染 ScoreRating。
  - 已評過的狀態只在掛載時讀一次；評完當下若父層立刻拿掉元件，感謝提示會跟著消失。
- GA 事件（joyu 的 GA4 串流 `G-V67Q0MXVS8`，`lib/analytics.ts` 新增 `trackEvent`）：
  - `home_layout_switch`：`{ to }`
  - `home_layout_rating`：`{ layout, score }`
- 不另外存後端；要看結果就到 GA 的事件報表。

## 檔案

| 檔案 | 內容 |
|------|------|
| `components/joyu/home/CompactHome.tsx` | 新版版面 |
| `pages/joyu/Home.tsx` | 依版面切換；原版面在 `ClassicHome` |
| `components/joyu/home/homeLayout.ts` | 版面偏好與評分的 hook（localStorage 讀寫包 try） |
| `components/joyu/home/HomeLayoutSwitch.tsx` | 切換＋評分 UI |
| `components/common/ScoreRating.tsx` | 共用評分元件 |
| `components/joyu/home/HomeRow.tsx` | 一排橫向滑動列 |
| `components/joyu/home/useFollowedActressVideos.ts` | 追蹤女優新片的資料（原版區塊與新版分頁共用） |

各區塊加 `compact`：

- `NewActressesSection`、`NewVideosSection`、`BirthdaySection`、`TopicsSection`、`JoyuHero`。
- `HomeSection` 加 `dense`。

共用元件的小擴充：

- `ActressCard` 加 `dense`。
- `VideoCoverCard` 加 `titleLines`（可依斷點給，0＝不顯示）。
- `AdSlot`／`JoyuAdSlot` 加 `size`（固定尺寸）。

## 驗證（本機 joyu.localhost）

| 尺寸 | 今天有新片 | 新片 | 近期生日 | 女優主題 |
|------|-----------|------|---------|---------|
| 1366×668（加 Hero Card 後） | 150–371 ✅ | 383–661 ✅ | 150–474 ✅ | 490–664 ✅ |
| 390×664 | 81–257 ✅ | 265–471 ✅ | 479–596 ✅ | 604–660 ✅ |

- 手機數值是在模擬環境量的：面板縮放後的 CSS 視窗是 442 寬，卡片寬度固定，所以高度可以直接對照 664。
- 切換：原版／新版正確切換並存進 localStorage。
- 評分：評分後收起；換版面重新詢問。驗證時有攔下 gtag，確認事件名稱與參數正確，沒有送出測試資料。
- 未驗證：
  - 「追蹤的女優」分頁（本機沒有登入有追蹤的帳號）。
  - 真廣告在新位置的顯示。

## 已知但未處理

- 手機 390 寬時頁首右側的「登入」與色彩切換按鈕會超出頁首底色，是原本就有的狀況，這次沒有動頁首。

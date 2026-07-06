# 整站 PWA 化工作卡

範圍：`static_site` 整個專案（不只 storyteller），評估用，尚未排入實作。

## 現況調查記錄

- 目前完全沒有 `manifest.webmanifest`、service worker、`vite-plugin-pwa` 或任何 PWA 相關套件。
- Icon 素材只有 `faryne-logo-{64,128,256}.png` 與 `faryne-icon-1024.jpg`，缺 192/512 與 maskable 版本。
- 部署在 Firebase Hosting，`dist/**/*.{js,css}` 已設定 `Cache-Control: public, max-age=31536000, immutable`（檔名帶 hash），這對 service worker precache 是好事，但也代表「更新提示」這張卡沒做好的話，使用者可能長時間卡在舊版本。
- build 流程裡有 `scripts/prerender.mjs`，會針對站上多個路由各自輸出獨立的 `dist/<route>/index.html`（帶各自的 title/description/OG 標籤），Firebase rewrite 規則是 `** → /index.html` 但静態檔案優先於 rewrite。這代表 service worker 如果簡單粗暴把所有導覽都導回同一份快取的 `index.html`，會讓這些有專屬 SEO meta 的路由被錯誤的殼頁蓋掉。
- 站上有載入 Google AdSense script，快取策略要避開，不要讓 SW 攔截或快取第三方廣告請求。
- 目前故事頁等動態內容全部即時打 API（`VITE_API_BASE`），沒有離線資料的概念。

## 工作卡

### 卡 1：Web App Manifest 與圖示素材
- 新增 `public/manifest.webmanifest`（name、short_name、theme_color、background_color、display: standalone、start_url、scope）
- 補齊 192x192、512x512 PNG，另外做一份 maskable 版本（Android adaptive icon 需要）
- `index.html` 加 `<link rel="manifest">`、iOS 專用 meta（`apple-mobile-web-app-capable` 等）
- 決定「安裝後這個 App 叫什麼名字」——站上同時有 storyteller、ETF 工具、NCCC 資料、galgame 等好幾個子功能，用整站品牌（Faryne 的實驗室）還是要為 storyteller 另外做獨立可安裝入口，需要先拍板
- 估點：S

### 卡 2：Service worker 與快取策略（核心，其他卡的地基）
- 導入 `vite-plugin-pwa`（workbox-based，跟現有 Vite 建置整合最省事）
- 静態資源（JS/CSS/圖片）：precache + cache-first（配合現有 immutable hash 檔名剛好合用）
- API 請求（`VITE_API_BASE` 打到 Go 後端的所有路徑）：要排除在 precache 外，用 network-first 或直接不快取，避免讀者看到過期章節內容、書籤資料
- 明確排除 Google AdSense 相關網域，不要讓 SW 攔截
- 針對 prerender 產生的多份 `index.html`：需要設計成讓每個路由各自快取自己那份，而不是全部 fallback 到同一份殼頁（否則深連結分享出去的 SEO 頁面可能被錯誤內容取代）
- 估點：M（這張卡風險最高，建議獨立一個 PR，做完要手動測過幾個關鍵路由）

### 卡 3：版本更新提示
- workbox `skipWaiting` + `clientsClaim` 沒配好的話，使用者會長時間卡在舊版 bundle（尤其現有 JS/CSS 已經是一年份 immutable cache）
- 加一個「有新版本可用，點擊重新整理」的小提示（toast 或固定橫幅），偵測到新 SW 安裝完成時跳出
- 估點：S，但依賴卡 2 先完成

### 卡 4：安裝提示 UX
- Android/Chrome：攔截 `beforeinstallprompt`，換成自訂「安裝 App」按鈕，而不是等瀏覽器預設提示
- iOS Safari 不支援 `beforeinstallprompt`，要另外做一個「如何加到主畫面」的圖文教學橫幅，不然 iOS 讀者完全不會發現能安裝
- 決定顯示位置：全站 header 通用，還是只在故事閱讀頁出現
- 估點：S-M

### 卡 5：離線行為範圍界定
- 誠實面對現況：內容全部是資料庫驅動，做不到「真的離線閱讀」，這張卡的務實目標是「殼頁秒開、網路不穩時不會整頁空白」，而不是離線也能看故事
- 頂多加一個簡單的「目前離線」提示頁，網路完全斷線時代替空白畫面
- 估點：S

### 卡 6：跨裝置/瀏覽器測試
- Android Chrome、iOS Safari（加到主畫面）、桌機 Chrome/Edge 各測一輪安裝流程
- 特別驗證：更新流程不會讓 SPA 路由或卡 2 提到的多份 prerender 頁面互相打架
- 估點：S，但要排在卡 2、3 都做完之後

### 卡 7（跳過，僅記錄關聯）：Web Push 通知
- 不在這批卡的範圍內，但這是先前討論過的「通知」功能的技術前提（VAPID key、訂閱資料表、後端發送端點）
- 之後真的要做通知時，回來看這張卡

## 建議順序

卡 1 → 卡 2 → 卡 3 → 卡 4/5（可平行）→ 卡 6。卡 2 是唯一有實質技術風險的部分，其餘都是照標準 PWA 清單走。

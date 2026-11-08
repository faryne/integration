// 各站品牌資訊：前端 runtime SEO（helpers/title.tsx）跟 build 時改寫 index.html（vite-plugins/siteBranding.ts）共用。
// 描述跟後端 service/sns 的同名常數是同一句，改的時候兩邊一起改。
// vite 設定也會讀這支檔案，所以不能 import 任何東西。

export interface SiteBranding {
  siteName: string;
  origin: string;
  description: string;
  /** 預設預覽圖（站內路徑） */
  ogImage: string;
}

// faryne.dev 主站；index.html 原始內容就是這一組，其他站 build 時把它換掉
export const FARYNE_BRANDING: SiteBranding = {
  siteName: "Faryne 的實驗室 by faryne.dev",
  origin: "https://faryne.dev",
  description:
    "Faryne 的個人實驗室，整理開放資料、ETF 與匯率工具、爬蟲工具、Threads 截圖工具，以及一些 side project。",
  ogImage: "/faryne-icon-1024.jpg",
};

// key 對應 build 時的 VITE_SITE（見 makefile 的 build-frontend-*）
export const SITE_BRANDING = {
  steamloom: {
    siteName: "SteamLoom",
    origin: "https://steamloom.works",
    description:
      "SteamLoom 是故事創作與發表平台：閱讀公開連載與親友分享的作品，也能用你習慣的 AI 透過 MCP 一起寫故事。",
    ogImage: "/steamloom-og-default.jpg",
  },
  // joyu.fyi 刻意跟主站切割，描述與預覽圖都不能帶 faryne.dev 的品牌
  joyu: {
    siteName: "joyu.fyi",
    origin: "https://joyu.fyi",
    description:
      "整理 AV 女優資料與作品索引：用名字、別名、主題找女優，查看出演作品與番號。",
    ogImage: "/joyu-og-default.jpg",
  },
  // galgame.tv、neko.maid.tw 還沒有自己的預覽圖，沿用主站頭像
  galgame: {
    siteName: "galgame.tv",
    origin: "https://galgame.tv",
    description:
      "收集美少女遊戲的 OP / ED / PV 等，採定時掃描追蹤頻道方式索引資料",
    ogImage: FARYNE_BRANDING.ogImage,
  },
  nekomaid: {
    siteName: "難以名狀的抓圖器",
    origin: "https://neko.maid.tw",
    description:
      "搜尋與瀏覽難以名狀的抓圖器收錄的 Pixiv、Niconico 靜畫與 TINAMI 作品索引。",
    ogImage: FARYNE_BRANDING.ogImage,
  },
} satisfies Record<string, SiteBranding>;

export type BrandedSite = keyof typeof SITE_BRANDING;

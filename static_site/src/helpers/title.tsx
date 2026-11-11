import { createContext, useContext, useEffect } from "react";

import { FARYNE_BRANDING, SITE_BRANDING } from "@/data/siteBranding.ts";
import { isJoyuSite } from "@/helpers/joyu.ts";
import { isSteamLoomSite, STEAMLOOM_PATH_PREFIX } from "@/helpers/steamloom.ts";

// 各站站名、描述、預設預覽圖統一定義在 data/siteBranding.ts（build 時改寫 index.html 也用同一份）
const { steamloom, joyu: joyuBrand, galgame, nekomaid } = SITE_BRANDING;
const steamloomOrigin = steamloom.origin;
const joyuOrigin = joyuBrand.origin;
const defaultCanonicalOrigin = FARYNE_BRANDING.origin;
// Firebase 預覽網域跟正式自訂網域會顯示同一份內容，canonical 一律指回自訂網域，
// 避免 Google 把兩者當成重複內容各自收錄一半。
const canonicalOriginByHost: Record<string, string> = {
  "neko.maid.tw": "https://neko.maid.tw",
  "nekomaid.web.app": "https://neko.maid.tw",
  "nekomaid.firebaseapp.com": "https://neko.maid.tw",
  "galgame.tv": "https://galgame.tv",
  "www.galgame.tv": "https://galgame.tv",
  "galgame-tv.web.app": "https://galgame.tv",
  "galgame-tv.firebaseapp.com": "https://galgame.tv",
  "steamloom.works": "https://steamloom.works",
  "www.steamloom.works": "https://steamloom.works",
  "steamloom-web.web.app": "https://steamloom.works",
  "steamloom-web.firebaseapp.com": "https://steamloom.works",
  "site.steamloom.works": "https://steamloom.works",
  "joyu.fyi": joyuOrigin,
  "www.joyu.fyi": joyuOrigin,
  "joyu-firebase.web.app": joyuOrigin,
  "joyu-firebase.firebaseapp.com": joyuOrigin,
  // 本機的獨立站網域（見 helpers/localSiteHost.ts）也指回正式網域
  "joyu.localhost": joyuOrigin,
  "galgame.localhost": "https://galgame.tv",
  "neko.localhost": "https://neko.maid.tw",
  "steamloom.localhost": steamloomOrigin,
};

function getCanonicalOrigin() {
  if (typeof window === "undefined") {
    return defaultCanonicalOrigin;
  }
  return (
    canonicalOriginByHost[window.location.hostname] ?? defaultCanonicalOrigin
  );
}

const defaultDescription = FARYNE_BRANDING.description;

const pageDescriptions: Record<string, string> = {
  首頁: defaultDescription,
  "AV 影片搜尋": "以番號、標籤、演員與片名搜尋影片資料的整理工具。",
  "AV 女優搜尋": "搜尋演員資料與作品索引的整理工具。",
  難以名狀的抓圖器: "搜尋與瀏覽 Nekomaid 收錄的插圖索引與作品圖片。",
  台灣指標: "查詢台灣公開統計指標，快速瀏覽資料趨勢與歷史紀錄。",
  匯率: "查詢主要貨幣匯率，並提供簡單的匯率換算工具。",
  "NCCC 信用卡消費資料":
    "查詢 NCCC 信用卡公開資料，依資料集、年月、地區與欄位條件篩選消費統計。",
  即時消防出勤記錄: "整理即時消防出勤公開資料，方便快速瀏覽事件列表。",
  台電敦親睦鄰捐助:
    "查詢台電敦親睦鄰捐助紀錄、受補助地區、申請單位與核准金額。",
  台電敦親睦鄰捐助地圖: "透過台灣縣市行政區地圖查詢台電敦親睦鄰捐助紀錄。",
  "ETF 投資導航": "整理台股 ETF 除息、填息與歷史統計資料的投資輔助工具。",
  爬蟲工具: "以規則設定方式測試網頁資料擷取結果的工具。",
  "Threads 截圖工具": "將 Threads 貼文轉成適合保存與分享的截圖。",
  網站截圖工具: "產生網站完整頁面截圖、縮圖與歷史紀錄連結，方便保存網頁狀態。",
  網站截圖歷史: "檢視指定網站截圖的歷史紀錄與圖片連結。",
  "Userscripts 列表": "整理 Faryne 維護或使用中的 userscripts 工具列表。",
};

// AV 女優／影片各頁標題都帶區塊名稱，例：「波多野結衣 - AV 女優搜尋 | 主站名稱」；
// 後端 service/sns/av_meta.go 給爬蟲的標題是同一套
export const AV_ACTRESS_SECTION = "AV 女優搜尋";
export const AV_VIDEO_SECTION = "AV 影片搜尋";
export const sectionTitle = (section: string, page?: string) =>
  page ? `${page} - ${section}` : section;

export interface SeoOptions {
  description?: string;
  image?: string;
  path?: string;
  robots?: string;
  type?: "website" | "article" | "profile";
}

// isSteamLoomPage：steamloom.works 獨立站，或 faryne.dev/storyteller 巢狀模式
function isSteamLoomPage() {
  if (typeof window === "undefined") {
    return false;
  }
  const { pathname } = window.location;
  return (
    isSteamLoomSite() ||
    pathname === STEAMLOOM_PATH_PREFIX ||
    pathname.startsWith(`${STEAMLOOM_PATH_PREFIX}/`)
  );
}

// 目前頁面屬於哪個站（站名、描述、預設預覽圖）
function getRouteBranding() {
  if (isSteamLoomPage()) {
    return steamloom;
  }
  if (isJoyuSite()) {
    return joyuBrand;
  }
  if (
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/nekomaid") ||
      window.location.hostname.indexOf("neko.maid.tw") >= 0)
  ) {
    return nekomaid;
  }
  if (
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/galgame") ||
      window.location.hostname.indexOf("galgame.tv") >= 0)
  ) {
    return galgame;
  }
  return FARYNE_BRANDING;
}

function getFullTitleForSite(page: string, currentSiteName: string) {
  if (!page.trim()) {
    return currentSiteName;
  }
  // SteamLoom 頁面的標題本身就帶品牌名（「X - SteamLoom」），不用再補一次
  if (page.trim() === currentSiteName || page.includes(currentSiteName)) {
    return page.trim();
  }
  return `${page} | ${currentSiteName}`;
}

// fallback：對不到頁面描述時的站台預設描述（joyu 不能落回 faryne.dev 的描述）
function getDescription(
  page: string,
  description?: string,
  fallback = defaultDescription,
) {
  if (description) {
    return description;
  }

  // 「X - AV 女優搜尋」這種帶區塊名稱的子頁也套用區塊的描述
  const matchedKey = Object.keys(pageDescriptions).find(
    (key) => page.startsWith(key) || page.endsWith(` - ${key}`),
  );

  return matchedKey ? pageDescriptions[matchedKey] : fallback;
}

function toAbsoluteUrl(value: string, origin = getCanonicalOrigin()) {
  return new URL(value, origin).toString();
}

// faryne.dev/storyteller/* 跟 steamloom.works 是同一份內容，canonical 一律指回 steamloom.works
// 並拿掉 /storyteller 前綴，避免兩個網域重複收錄（後端 service/sns 的社群預覽也是同一套規則）
function toCanonicalUrl(value: string) {
  const url = new URL(value, getCanonicalOrigin());
  const { pathname } = url;
  if (
    pathname !== STEAMLOOM_PATH_PREFIX &&
    !pathname.startsWith(`${STEAMLOOM_PATH_PREFIX}/`)
  ) {
    return url.toString();
  }
  const steamloomPathname = pathname.slice(STEAMLOOM_PATH_PREFIX.length) || "/";
  return new URL(
    `${steamloomPathname}${url.search}`,
    steamloomOrigin,
  ).toString();
}

export function setMetaByName(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(canonicalUrl: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", canonicalUrl);
}

function setJsonLd(id: string, data: Record<string, unknown>) {
  let element = document.getElementById(id) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data);
}

// 網站頁面嵌在非網站宿主（SteamLoom Writer 桌面版）時設為 true：
// 不改 document.title（會變成視窗標題）與 SEO meta。網站本身不提供，維持預設 false。
export const SeoDisabledContext = createContext(false);

export function useSeo(page: string, options: SeoOptions = {}) {
  const disabled = useContext(SeoDisabledContext);
  useEffect(() => {
    if (disabled) return;
    const brand = getRouteBranding();
    const currentSiteName = brand.siteName;
    // SteamLoom（含 faryne.dev/storyteller 巢狀模式）不套頁面描述表，預覽圖也一律指向 steamloom.works
    const isSteamLoom = brand === steamloom;
    const title = getFullTitleForSite(page, currentSiteName);
    const description = isSteamLoom
      ? (options.description ?? brand.description)
      : getDescription(page, options.description, brand.description);
    const canonicalUrl = toCanonicalUrl(
      options.path ?? `${window.location.pathname}${window.location.search}`,
    );
    const imageUrl = toAbsoluteUrl(
      options.image ?? brand.ogImage,
      isSteamLoom ? brand.origin : undefined,
    );
    const robots = options.robots ?? "index, follow";
    const type = options.type ?? "website";

    document.title = title;

    setCanonical(canonicalUrl);
    setMetaByName("description", description);
    setMetaByName("robots", robots);
    setMetaByName("twitter:card", "summary_large_image");
    setMetaByName("twitter:title", title);
    setMetaByName("twitter:description", description);
    setMetaByName("twitter:image", imageUrl);

    setMetaByProperty("og:type", type);
    setMetaByProperty("og:site_name", currentSiteName);
    setMetaByProperty("og:locale", "zh_TW");
    setMetaByProperty("og:title", title);
    setMetaByProperty("og:description", description);
    setMetaByProperty("og:url", canonicalUrl);
    setMetaByProperty("og:image", imageUrl);
    setMetaByProperty("og:image:alt", currentSiteName);

    setJsonLd("site-json-ld", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: currentSiteName,
      url: isSteamLoom ? brand.origin : getCanonicalOrigin(),
      description: brand.description,
      inLanguage: "zh-Hant-TW",
    });
  }, [
    disabled,
    page,
    options.description,
    options.image,
    options.path,
    options.robots,
    options.type,
  ]);
}

export function useTitle(page: string, options: SeoOptions = {}) {
  useSeo(page, options);
}

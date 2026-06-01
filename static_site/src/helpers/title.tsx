import { useEffect } from "react";

const siteName = "ha2.tw / faryne.dev";
const canonicalOrigin = "https://faryne.dev";
const defaultDescription =
  "Faryne 的個人實驗室，整理開放資料、ETF 與匯率工具、爬蟲工具、Threads 截圖工具，以及一些 side project。";
const defaultImage = "/faryne-icon-1024.jpg";

const pageDescriptions: Record<string, string> = {
  首頁: defaultDescription,
  "AV 影片搜尋": "以番號、標籤、演員與片名搜尋影片資料的整理工具。",
  "AV 女優搜尋": "搜尋演員資料與作品索引的整理工具。",
  台灣指標: "查詢台灣公開統計指標，快速瀏覽資料趨勢與歷史紀錄。",
  匯率: "查詢主要貨幣匯率，並提供簡單的匯率換算工具。",
  即時消防出勤記錄: "整理即時消防出勤公開資料，方便快速瀏覽事件列表。",
  "ETF 投資導航": "整理台股 ETF 除息、填息與歷史統計資料的投資輔助工具。",
  爬蟲工具: "以規則設定方式測試網頁資料擷取結果的工具。",
  "Threads 截圖工具": "將 Threads 貼文轉成適合保存與分享的截圖。",
  "Userscripts 列表": "整理 Faryne 維護或使用中的 userscripts 工具列表。",
};

export interface SeoOptions {
  description?: string;
  image?: string;
  path?: string;
  robots?: string;
  type?: "website" | "article";
}

function getFullTitle(page: string) {
  return page.trim() ? `${page} | ${siteName}` : siteName;
}

function getDescription(page: string, description?: string) {
  if (description) {
    return description;
  }

  const matchedKey = Object.keys(pageDescriptions).find((key) =>
    page.startsWith(key),
  );

  return matchedKey ? pageDescriptions[matchedKey] : defaultDescription;
}

function toAbsoluteUrl(value: string, origin = canonicalOrigin) {
  return new URL(value, origin).toString();
}

function setMetaByName(name: string, content: string) {
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

export function useSeo(page: string, options: SeoOptions = {}) {
  useEffect(() => {
    const title = getFullTitle(page);
    const description = getDescription(page, options.description);
    const canonicalUrl = toAbsoluteUrl(
      options.path ?? `${window.location.pathname}${window.location.search}`,
    );
    const imageUrl = toAbsoluteUrl(options.image ?? defaultImage);
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
    setMetaByProperty("og:site_name", siteName);
    setMetaByProperty("og:locale", "zh_TW");
    setMetaByProperty("og:title", title);
    setMetaByProperty("og:description", description);
    setMetaByProperty("og:url", canonicalUrl);
    setMetaByProperty("og:image", imageUrl);
    setMetaByProperty("og:image:alt", siteName);

    setJsonLd("site-json-ld", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: canonicalOrigin,
      description: defaultDescription,
      inLanguage: "zh-Hant-TW",
    });
  }, [
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

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const indexPath = path.join(distDir, "index.html");

const siteName = "ha2.tw / faryne.dev";
const siteOrigin = "https://beta.faryne.dev";
const defaultImage = `${siteOrigin}/faryne-icon-1024.jpg`;
const defaultDescription =
  "Faryne 的個人實驗室，整理開放資料、ETF 與匯率工具、爬蟲工具、Threads 截圖工具，以及一些 side project。";

const routes = [
  {
    path: "/",
    title: siteName,
    description: defaultDescription,
  },
  {
    path: "/data/rates",
    title: `匯率 | ${siteName}`,
    description: "查詢主要貨幣匯率，並提供簡單的匯率換算工具。",
  },
  {
    path: "/data/etf/yieldmax",
    title: `YieldMax ETF 配息統計 | ${siteName}`,
    description: "整理 YieldMax ETF 配息資料、歷史紀錄與分割資訊。",
  },
  {
    path: "/data/etf/twse",
    title: `ETF 投資導航 | ${siteName}`,
    description: "整理台股 ETF 除息、填息與歷史統計資料的投資輔助工具。",
  },
  {
    path: "/data/fire/realtime",
    title: `即時消防出勤記錄 | ${siteName}`,
    description: "整理即時消防出勤公開資料，方便快速瀏覽事件列表。",
  },
  {
    path: "/data/tw-stats",
    title: `台灣指標 | ${siteName}`,
    description: "查詢台灣公開統計指標，快速瀏覽資料趨勢與歷史紀錄。",
  },
  {
    path: "/tools/crawler",
    title: `爬蟲工具 | ${siteName}`,
    description: "以規則設定方式測試網頁資料擷取結果的工具。",
  },
  {
    path: "/tools/thread/capture",
    title: `Threads 截圖工具 | ${siteName}`,
    description: "將 Threads 貼文轉成適合保存與分享的截圖。",
  },
  {
    path: "/tools/userscripts",
    title: `Userscripts 列表 | ${siteName}`,
    description: "整理 Faryne 維護或使用中的 userscripts 工具列表。",
  },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll("</script", "<\\/script");
}

function replaceTagContent(html, tagName, content) {
  const pattern = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?</${tagName}>`, "i");
  return html.replace(pattern, `<${tagName}>${content}</${tagName}>`);
}

function replaceAttributeTag(html, selector, attribute, value) {
  const escapedValue = escapeHtml(value);
  const pattern = new RegExp(`(<[^>]+${selector}[^>]+${attribute}=")[^"]*(")`);
  return html.replace(pattern, `$1${escapedValue}$2`);
}

function replaceMetaName(html, name, content) {
  return replaceAttributeTag(html, `name="${name}"`, "content", content);
}

function replaceMetaProperty(html, property, content) {
  return replaceAttributeTag(
    html,
    `property="${property}"`,
    "content",
    content,
  );
}

function routeHtml(template, route) {
  const canonicalUrl = new URL(route.path, siteOrigin).toString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: route.title,
    url: canonicalUrl,
    description: route.description,
    isPartOf: {
      "@type": "WebSite",
      name: siteName,
      url: siteOrigin,
    },
    inLanguage: "zh-Hant-TW",
  };

  let html = template;
  html = replaceTagContent(html, "title", escapeHtml(route.title));
  html = replaceAttributeTag(html, 'rel="canonical"', "href", canonicalUrl);
  html = replaceMetaName(html, "description", route.description);
  html = replaceMetaName(html, "twitter:title", route.title);
  html = replaceMetaName(html, "twitter:description", route.description);
  html = replaceMetaName(html, "twitter:image", defaultImage);
  html = replaceMetaProperty(html, "og:title", route.title);
  html = replaceMetaProperty(html, "og:description", route.description);
  html = replaceMetaProperty(html, "og:url", canonicalUrl);
  html = replaceMetaProperty(html, "og:image", defaultImage);
  html = replaceTagContent(
    html,
    "script",
    escapeScriptJson(jsonLd),
  ).replace(
    /<script>/,
    '<script type="application/ld+json" id="site-json-ld">',
  );

  return html;
}

function routeOutputPath(routePath) {
  if (routePath === "/") {
    return indexPath;
  }

  return path.join(distDir, routePath, "index.html");
}

const template = await readFile(indexPath, "utf8");

for (const route of routes) {
  const outputPath = routeOutputPath(route.path);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, routeHtml(template, route));
}

console.log(`Prerendered ${routes.length} routes.`);

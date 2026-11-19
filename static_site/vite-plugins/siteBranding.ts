import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

import {
  FARYNE_BRANDING,
  SITE_BRANDING,
  type BrandedSite,
} from "../src/data/siteBranding.ts";
import { JOYU_SITE_FEEDS, type JoyuFeed } from "../src/data/joyuFeeds.ts";

// 所有站共用同一份 index.html，裡面寫死的是 faryne.dev 的站名、描述、canonical、預覽圖。
// Google favicon 服務、部分爬蟲不會執行 JS，看不到 runtime 換上的內容，所以獨立站的 build（VITE_SITE=xxx）
// 直接把 HTML 裡的品牌資訊換成該站的；主站 build（沒有 VITE_SITE）不動。

// 有自己圖示的站：換掉 favicon，並補一個真的 /favicon.ico（其他站沒有這個檔，維持原狀）
const siteIcons: Partial<
  Record<
    BrandedSite,
    { icons: string; appleTouchIcon: string; faviconIco: string }
  >
> = {
  steamloom: {
    icons:
      '<link rel="icon" type="image/png" href="/steamloom-icon-256.png" />\n    <link rel="icon" type="image/svg+xml" href="/steamloom-icon.svg" />',
    appleTouchIcon: "/steamloom-icon-180.png",
    faviconIco: "steamloom-favicon.ico",
  },
  joyu: {
    icons: '<link rel="icon" type="image/png" href="/joyu-icon-256.png" />',
    appleTouchIcon: "/joyu-icon-180.png",
    faviconIco: "joyu-favicon.ico",
  },
};

// 有 RSS 的站：在 canonical 後面加 <link rel="alternate">，閱讀器、瀏覽器外掛貼首頁網址就找得到 feed（不用執行 JS）
const siteFeeds: Partial<Record<BrandedSite, JoyuFeed[]>> = {
  joyu: JOYU_SITE_FEEDS,
};

// 成人站：加上成人內容標記（Google SafeSearch 靠它分辨，不用等 JS），並拔掉 AdSense
// （AdSense 不能出現在成人站上，違反政策會連累帳號；publisher ID 也會把兩站連在一起）
const adultSites: BrandedSite[] = ["joyu"];

const isBrandedSite = (site?: string): site is BrandedSite =>
  Boolean(site && site in SITE_BRANDING);

export function siteBrandingPlugin(site?: string): Plugin {
  return {
    name: "site-branding",
    apply: "build",
    transformIndexHtml(html) {
      if (!isBrandedSite(site)) {
        return html;
      }
      const brand = SITE_BRANDING[site];
      const f = FARYNE_BRANDING;
      let out = html
        .replaceAll(f.siteName, brand.siteName)
        .replaceAll(f.description, brand.description)
        .replaceAll(
          `${f.origin}${f.ogImage}`,
          `${brand.origin}${brand.ogImage}`,
        )
        .replaceAll(f.origin, brand.origin);
      const icon = siteIcons[site];
      if (icon) {
        out = out
          .replace(/<link rel="icon"[^>]*>/, icon.icons)
          .replace(
            /<link rel="apple-touch-icon"[^>]*>/,
            `<link rel="apple-touch-icon" href="${icon.appleTouchIcon}" />`,
          );
      }
      const feeds = siteFeeds[site];
      if (feeds) {
        const links = feeds
          .map(
            (f) =>
              `<link rel="alternate" type="application/rss+xml" title="${brand.siteName} ${f.title}" href="${f.url}" />`,
          )
          .join("\n    ");
        out = out.replace(/(<link rel="canonical"[^>]*>)/, `$1\n    ${links}`);
      }
      if (adultSites.includes(site)) {
        out = out
          .replace(
            '<meta name="robots"',
            '<meta name="rating" content="adult" />\n    <meta name="robots"',
          )
          .replace(/<script[^>]*adsbygoogle[^>]*>\s*<\/script>/, "");
      }
      return out;
    },
    generateBundle() {
      const icon = isBrandedSite(site) ? siteIcons[site] : undefined;
      if (!icon) {
        return;
      }
      this.emitFile({
        type: "asset",
        fileName: "favicon.ico",
        source: fs.readFileSync(
          path.resolve(__dirname, "../public", icon.faviconIco),
        ),
      });
    },
  };
}

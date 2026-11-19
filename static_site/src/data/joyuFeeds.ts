// joyu.fyi 的 RSS（後端 service/av/joyu_rss.go，nginx 把 /feed/* 轉給後端）。
// vite 也會讀這支（build 時把全站 feed 寫進 index.html 的 <link rel="alternate">），只能用相對路徑 import。
// 網址一律是正式站的，本機複製出去也能直接訂閱
import { SITE_BRANDING } from "./siteBranding.ts";

export interface JoyuFeed {
  title: string;
  url: string;
}

export const JOYU_FEED_ORIGIN = `${SITE_BRANDING.joyu.origin}/feed`;

/**
 * 一組 feed：新片＋即將發售三種範圍（依 DMM 收藏數取前 100 部）。
 * 指定女優時網址最後加名字、帶上女優頁的參數（query，例如 xcity_id=4043），標題前面放名字
 */
export const joyuFeeds = (actress?: {
  name: string;
  query: string;
}): JoyuFeed[] => {
  const path = actress ? `/${encodeURIComponent(actress.name)}` : "";
  const and = actress ? `&${actress.query}` : "";
  const title = actress ? `${actress.name} ` : "";
  return [
    {
      title: `${title}新片`,
      url: `${JOYU_FEED_ORIGIN}/new${path}${actress ? `?${actress.query}` : ""}`,
    },
    ...[
      ["1day", "明天"],
      ["1week", "7 天內"],
      ["1month", "30 天內"],
    ].map(([range, label]) => ({
      title: `${title}即將發售・${label}`,
      url: `${JOYU_FEED_ORIGIN}/upcoming${path}?range=${range}${and}`,
    })),
  ];
};

/** 全站的 feed（首頁、即將發售頁、index.html 的 alternate） */
export const JOYU_SITE_FEEDS = joyuFeeds();

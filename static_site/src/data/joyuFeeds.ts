// joyu.fyi 的 RSS（後端 service/av/joyu_rss.go，nginx 把 /feed/* 轉給後端）。
// vite 也會讀這支（build 時把全站 feed 寫進 index.html 的 <link rel="alternate">），只能用相對路徑 import。
// 網址一律是正式站的，本機複製出去也能直接訂閱
import { SITE_BRANDING } from "./siteBranding.ts";

export interface JoyuFeed {
  title: string;
  url: string;
}

export const JOYU_FEED_ORIGIN = `${SITE_BRANDING.joyu.origin}/feed`;

/** 全站的 feed：新片、即將發售三種範圍（依 DMM 收藏數取前 100 部） */
export const JOYU_SITE_FEEDS: JoyuFeed[] = [
  { title: "新片", url: `${JOYU_FEED_ORIGIN}/new` },
  { title: "即將發售・明天", url: `${JOYU_FEED_ORIGIN}/upcoming?range=1day` },
  {
    title: "即將發售・7 天內",
    url: `${JOYU_FEED_ORIGIN}/upcoming?range=1week`,
  },
  {
    title: "即將發售・30 天內",
    url: `${JOYU_FEED_ORIGIN}/upcoming?range=1month`,
  },
];

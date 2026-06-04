import type { LayoutDropMenu, LayoutNavigationItem } from "@/types/layout.ts";

export const headerNavigationItems: LayoutNavigationItem[] = [
  {
    title: "首頁",
    href: "/",
  },
  {
    title: "大人的喜好",
    items: [
      {
        title: "難以名狀的抓圖器",
        href: "/nekomaid",
      },
      {
        title: "二次元常用英文 tag",
        href: "/yandere/tags",
      },
      {
        title: "AV 影片搜尋",
        href: "/av/video",
      },
      {
        title: "AV 女優搜尋",
        href: "/av/actress",
      },
    ],
  },
  {
    title: "方便工具",
    items: [
      {
        title: "匯率",
        href: "/data/rates",
      },
      {
        title: "YieldMax ETF 配息統計",
        href: "/data/etf/yieldmax",
      },
      {
        title: "台股 ETF 資訊",
        href: "/data/etf/twse",
      },
      {
        title: "即時消防出勤記錄",
        href: "/data/fire/realtime",
      },
      {
        title: "台灣指標",
        href: "/data/tw-stats",
      },
      {
        title: "爬蟲工具",
        href: "/tools/crawler",
      },
      {
        title: "Threads 截圖工具",
        href: "/tools/thread/capture",
      },
      {
        title: "網站截圖工具",
        href: "/tools/webshot",
      },
      {
        title: "Userscripts",
        href: "/tools/userscripts",
      },
    ],
  },
  {
    title: "部落格",
    href: "https://blog.faryne.dev",
    external: true,
  },
];

export function isLayoutDropMenu(
  item: LayoutNavigationItem,
): item is LayoutDropMenu {
  return "items" in item;
}

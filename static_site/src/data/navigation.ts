import type { LayoutDropMenu, LayoutNavigationItem } from "@/types/layout.ts";

export const headerNavigationItems: LayoutNavigationItem[] = [
  {
    title: "首頁",
    href: "/",
  },
  // {
  //   title: "關於我",
  //   href: "/about",
  // },
  {
    title: "大人的喜好",
    items: [
      {
        title: "Galgame 影片",
        href: "https://galgame.tv/",
        external: true,
        description: "收集美少女遊戲的 OP / ED / PV 等，採定時掃描追蹤頻道方式索引資料",
      },
      {
        title: "難以名狀的抓圖器",
        href: "https://neko.maid.tw/",
        external: true,
        description: "爬取 Pixiv / Niconico 等平台的圖片，並進入收藏",
      },
      {
        title: "二次元常用英文 tag",
        href: "/yandere/tags",
      },
      {
        title: "AV 影片搜尋",
        href: "/av/video",
        description: "定時索引 Fanza(a.k.a. DMM) AV影片資訊"
      },
      {
        title: "AV 女優搜尋",
        href: "/av/actress",
        description: "定時索引 AV 女優資訊"
      },
    ],
  },
  {
    title: "資料",
    items: [
      {
        title: "匯率",
        href: "/data/rates",
        description: "列出主要銀行對各貨幣的匯率資料，也可以計算出在哪間銀行買賣最划算"
      },
      {
        title: "NCCC 信用卡消費資料",
        href: "/data/nccc",
        description: "列出 NCCC 信用卡的消費資料，用以資料統計"
      },
      {
        title: "YieldMax ETF 配息統計",
        href: "/data/etf/yieldmax",
        description: "列出 YieldMax ETF 的配息資料，並附上簡單計算總配息的計算器"
      },
      {
        title: "台股 ETF 資訊",
        href: "/data/etf/twse",
        description: "追蹤台股 ETF 配息資訊"
      },
      {
        title: "即時消防出勤記錄",
        href: "/data/fire/realtime",
        description: "列出台灣各縣市消防即時出勤記錄"
      },
      {
        title: "台電敦親睦鄰捐助",
        href: "/data/taipower/neighbor",
        description: "追蹤/統計台電敦親睦鄰捐助資訊"
      },
      {
        title: "台灣指標",
        href: "/data/tw-stats",
        description: "收集主計總處所每年定期發布的台灣各類相關指標，包含且不限於：人口、土地面積等"
      },
    ],
  },
  {
    title: "方便工具",
    items: [
      {
        title: "爬蟲工具",
        href: "/tools/crawler",
        description: "使用 css selectors 來爬取網頁資料"
      },
      {
        title: "Threads 截圖工具",
        href: "/tools/thread/capture",
        description: "擷取 threads 上貼文內容並轉化為圖片"
      },
      {
        title: "網站截圖工具",
        href: "/tools/webshot",
        description: "擷取網頁內容並轉化為圖片"
      },
      {
        title: "Userscripts",
        href: "/tools/userscripts",
        description: "收集我做的 userscripts "
      },
      {
        title: "MCP 方法列表",
        href: "/tools/mcp",
        description: "讀取 /mcp tools/list 並列出可呼叫方法與參數說明"
      },
    ],
  },
  {
    title: "部落格",
    href: "https://blog.faryne.dev",
    external: true,
  },
  // {
  //   title: "登入",
  //   href: "/login",
  // },
];

export function isLayoutDropMenu(
  item: LayoutNavigationItem,
): item is LayoutDropMenu {
  return "items" in item;
}

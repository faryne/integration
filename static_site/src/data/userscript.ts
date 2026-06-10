interface Userscript {
  name: string;
  description: string;
  url: string;
}

export const userscripts: Record<string, Userscript> = {
  nekomaid: {
    name: "難以名狀的抓圖器",
    description: "抓取 Pixiv / NicoSeiga / Tinami 的圖片並儲存到 neko.maid.app",
    url: "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/nekomaid-retriever-userscript.js",
  },
  av: {
    name: "AV 女優換圖",
    description: "自動將網頁中的圖片隨機替換為 AV 女優圖庫圖片（純屬娛樂）。",
    url: "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/av-image-replacer.user.js",
  },
  threads_capture: {
    name: "Threads 截圖工具",
    description: "在 Threads 貼文旁加入截圖按鈕，快速產生並下載 PNG 截圖。",
    url: "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/threads-capture.user.js",
  },
};

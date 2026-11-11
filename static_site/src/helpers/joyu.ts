// joyu.fyi（AV 女優資料站）的網域判斷與路徑組裝，跟 helpers/galgame.ts、helpers/steamloom.ts 同一套 pattern。
// 差別在 AV 頁面只在 joyu.fyi 上提供，faryne.dev 不再掛巢狀路由（刻意跟主站切割）：
// 在 joyu 網域內回站內路徑；在其他網域（faryne.dev 整合後台）回完整網址，點了直接開到 joyu.fyi。

import { SITE_BRANDING } from "@/data/siteBranding.ts";

const joyuHosts = [
  "joyu.fyi",
  "www.joyu.fyi",
  "joyu-firebase.web.app",
  "joyu-firebase.firebaseapp.com",
  // 本機開發用 http://joyu.localhost:5174 測獨立站（*.localhost 瀏覽器會自動解析到 127.0.0.1）
  "joyu.localhost",
];

export const JOYU_SITE_NAME = SITE_BRANDING.joyu.siteName;

export function isJoyuSite() {
  if (typeof window === "undefined") {
    return false;
  }
  return joyuHosts.includes(window.location.hostname);
}

// 本機開發時整合後台在 localhost:<port>，連過去要換成 joyu.localhost 同一個 port
const joyuOrigin = () =>
  import.meta.env.DEV
    ? `http://joyu.localhost:${window.location.port}`
    : "https://joyu.fyi";

/** joyu 的頁面路徑：path 不用帶開頭斜線，空字串是首頁（女優）；可以直接帶 query，例如 "?name=xxx" */
export function joyuPath(path = "") {
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  return isJoyuSite() ? normalizedPath : `${joyuOrigin()}${normalizedPath}`;
}

// 番號格式：英文 2～6 碼＋（可省略的）連字號＋數字 2～5 碼，例如 ABCD-123、abcd123。
// DMM 內部番號（h_237nact00198）不會被當成番號，會進女優搜尋
const videoCodePattern = /^([A-Za-z]{2,6})-?(\d{2,5})$/;

/** 輸入的是番號就回統一格式（大寫加連字號，例如 ABCD-123），不是就回 undefined */
export function joyuVideoCode(input: string) {
  const code = input.trim().match(videoCodePattern);
  return code ? `${code[1].toUpperCase()}-${code[2]}` : undefined;
}

/** 首頁與頁首搜尋框：番號直接到影片頁（統一成大寫加連字號），其他當女優名字到女優搜尋 */
export function joyuSearchPath(input: string) {
  const text = input.trim();
  const code = joyuVideoCode(text);
  if (code) {
    return joyuPath(`video/${code}`);
  }
  return joyuPath(
    text ? `actress?name=${encodeURIComponent(text)}` : "actress",
  );
}

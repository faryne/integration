// joyu.fyi（AV 女優資料站）的網域判斷與路徑組裝，跟 helpers/galgame.ts、helpers/steamloom.ts 同一套 pattern。
// 差別在 AV 頁面只在 joyu.fyi 上提供，faryne.dev 不再掛巢狀路由（刻意跟主站切割）：
// 在 joyu 網域內回站內路徑；在其他網域（faryne.dev 整合後台）回完整網址，點了直接開到 joyu.fyi。

const joyuHosts = [
  "joyu.fyi",
  "www.joyu.fyi",
  "joyu-firebase.web.app",
  "joyu-firebase.firebaseapp.com",
  // 本機開發用 http://joyu.localhost:5173 測獨立站（*.localhost 瀏覽器會自動解析到 127.0.0.1）
  "joyu.localhost",
];

export const JOYU_SITE_NAME = "joyu.fyi";

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

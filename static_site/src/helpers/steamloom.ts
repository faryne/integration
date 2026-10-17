// SteamLoom（Storyteller）獨立網域判斷跟路徑組裝，跟 helpers/galgame.ts、
// helpers/nekomaid.ts 是同一套 pattern：同一份建置檔案依網域名稱動態決定要不要
// 顯示 /storyteller 前綴，不需要另外開一份 build。

export const STEAMLOOM_PATH_PREFIX = "/storyteller";

const steamloomHosts = [
  "steamloom.works",
  "www.steamloom.works",
  "steamloom-web.web.app",
  "steamloom-web.firebaseapp.com",
  "site.steamloom.works",
];

export function isSteamLoomSite() {
  if (typeof window === "undefined") {
    return false;
  }

  return steamloomHosts.includes(window.location.hostname);
}

// 依指定 origin 組完整網址：steamloom.works 網域不帶 /storyteller 前綴，其他網域（faryne.dev、本機）要帶。
// 給不在網站底下的宿主（SteamLoom Writer）用；steamloomPath 只看目前視窗網域，在 Writer 裡會判斷錯。
export function steamloomUrlForOrigin(origin: string, path: string) {
  let host = "";
  try {
    host = new URL(origin).hostname;
  } catch {
    // origin 格式不對時當成非 SteamLoom 網域
  }
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  return `${origin}${steamloomHosts.includes(host) ? "" : STEAMLOOM_PATH_PREFIX}${normalizedPath}`;
}

export function steamloomPath(path = "") {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return (
    `${isSteamLoomSite() ? "" : STEAMLOOM_PATH_PREFIX}${normalizedPath}` || "/"
  );
}

// 創作者頁（本人或筆名）的路徑；筆名可能含空白或符號，一律 encode
export const steamloomCreatorPath = (penName: string) =>
  steamloomPath(`user/${encodeURIComponent(penName)}`);

// 作者動態分頁與貼文單頁；commentId 帶上時捲到那則留言
export const steamloomPostsPath = (penName: string) =>
  `${steamloomCreatorPath(penName)}/posts`;
export const steamloomPostPath = (
  penName: string,
  postId: string,
  commentId?: string,
) =>
  `${steamloomPostsPath(penName)}/${postId}${commentId ? `#c-${commentId}` : ""}`;

// SteamLoom（Storyteller）獨立網域判斷跟路徑組裝，跟 helpers/galgame.ts、
// helpers/nekomaid.ts 是同一套 pattern：同一份建置檔案依網域名稱動態決定要不要
// 顯示 /storyteller 前綴，不需要另外開一份 build。

export function isSteamLoomSite() {
  if (typeof window === "undefined") {
    return false;
  }

  return [
    "steamloom.works",
    "www.steamloom.works",
    "steamloom-web.web.app",
    "steamloom-web.firebaseapp.com",
    "site.steamloom.works",
  ].includes(window.location.hostname);
}

export function steamloomPath(path = "") {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${isSteamLoomSite() ? "" : "/storyteller"}${normalizedPath}` || "/";
}

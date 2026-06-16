export function galgameBrandSlug(publicId: string, name: string) {
  const readableName = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/?#%]+/g, "");
  return readableName ? `${publicId}-${readableName}` : publicId;
}

export function isGalgameSite() {
  return [
    "galgame.tv",
    "www.galgame.tv",
    "galgame-tv.web.app",
    "galgame-tv.firebaseapp.com",
  ].includes(window.location.hostname);
}

export function galgamePath(path = "") {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${isGalgameSite() ? "" : "/galgame"}${normalizedPath}` || "/";
}

export function formatGalgameDuration(seconds?: number) {
  if (!seconds) {
    return "";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

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

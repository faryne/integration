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

// 宣傳片類型關鍵字：英文縮寫前後不能緊鄰英文字母，避免把「Shop」「EDEN」這類字切開
const promoKeywordPattern =
  /\s*(?:(?<![A-Za-z])(?:OP|ED|PV|CM)(?![A-Za-z])|オープニング|エンディング|プロモーション|体験版|ティザー|トレーラー|ムービー)/;

/**
 * 從影片標題推測作品名：去掉『』「」【】括號後，取宣傳片關鍵字之前的部分。
 * 例：「王様恋愛 体験版プレイムービー04」→「王様恋愛」。只用來把同作品的影片排在一起，不當正式資料顯示。
 */
export function galgameWorkTitle(title: string) {
  const work = title
    .replace(/[『』「」【】]/g, " ")
    .split(promoKeywordPattern)[0]
    .trim();
  return work.length >= 2 ? work : "";
}

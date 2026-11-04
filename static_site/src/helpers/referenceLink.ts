import type { ActressLink } from "@/types/av.ts";

/** 網址的網域（去掉 www.），連結沒填名稱時顯示；女優、影片的參考連結共用 */
export function linkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function linkLabel(link: ActressLink) {
  return link.title || linkHost(link.url);
}

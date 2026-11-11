import type { NekomaidArtwork } from "@/types/nekomaid.ts";
import { userscripts } from "@/data/userscript.ts";
import { setAgeConfirmed, useAgeConfirmed } from "@/helpers/ageConfirmation.ts";

export const siteLabels: Record<string, string> = {
  pixiv: "Pixiv",
  nico: "Niconico 靜畫",
  tinami: "TINAMI",
};

export const nekomaidUserscriptUrl = userscripts["nekomaid"].url;

export function isNekomaidSite() {
  if (typeof window === "undefined") {
    return false;
  }

  return [
    "nekomaid.web.app",
    "nekomaid.firebaseapp.com",
    "neko.maid.tw",
    // 本機用 http://neko.localhost:5174 測獨立站（見 helpers/localSiteHost.ts）
    "neko.localhost",
  ].includes(window.location.hostname);
}

export function nekomaidPath(path = "") {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${isNekomaidSite() ? "" : "/nekomaid"}${normalizedPath}` || "/";
}

export function itemSite(item: NekomaidArtwork) {
  return String(item.site ?? item.from ?? "");
}

export function artworkPath(item: NekomaidArtwork) {
  return nekomaidPath(`${itemSite(item)}/${item.author_id}/${item.artwork_id}`);
}

export function artworkShareUrl(item: NekomaidArtwork) {
  const path = artworkPath(item);
  if (typeof window === "undefined") {
    return `${path}`;
  }
  return `${window.location.origin}${path}`;
}

function isTruthyFlag(value: boolean | number | undefined) {
  return value === true || value === 1;
}

export function isR18Artwork(item: NekomaidArtwork) {
  return isTruthyFlag(item.is_r18) || item.r18 === true;
}

export function isAnimatedArtwork(item: NekomaidArtwork) {
  return isTruthyFlag(item.is_animated) || isTruthyFlag(item.gif);
}

export function artworkPhotoCount(item: NekomaidArtwork) {
  return Number(item.photos_cnt ?? item.photos?.length ?? 0);
}

export function setR18ConfirmedCookie() {
  setAgeConfirmed();
}

export function useR18Confirmed() {
  return useAgeConfirmed();
}

/** 來源站的作品原始頁網址；不支援的站回空字串（禁抓後台、版權申告也用） */
export function siteArtworkUrl(site: string, artworkId: string | number) {
  if (site === "pixiv") return `https://www.pixiv.net/artworks/${artworkId}`;
  if (site === "nico") return `https://seiga.nicovideo.jp/seiga/${artworkId}`;
  if (site === "tinami") return `https://www.tinami.com/view/${artworkId}`;
  return "";
}

/** 來源站的畫師頁網址；不支援的站回空字串 */
export function siteAuthorUrl(site: string, authorId: string | number) {
  if (site === "pixiv") return `https://www.pixiv.net/users/${authorId}`;
  if (site === "nico")
    return `https://seiga.nicovideo.jp/user/illust/${authorId}`;
  if (site === "tinami")
    return `https://www.tinami.com/creator/profile/${authorId}`;
  return "";
}

export function externalArtworkUrl(item: NekomaidArtwork) {
  if (item.artwork_page) return item.artwork_page;
  return (
    siteArtworkUrl(itemSite(item), item.artwork_id) ||
    (item.nekomaid_link ?? "")
  );
}

export function externalAuthorUrl(item: NekomaidArtwork) {
  if (item.author_page) return item.author_page;
  return (
    siteAuthorUrl(itemSite(item), item.author_id) || (item.nekomaid_link ?? "")
  );
}

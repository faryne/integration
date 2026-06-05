import { useSyncExternalStore } from "react";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";

export const siteLabels: Record<string, string> = {
  pixiv: "Pixiv",
  nico: "Niconico 靜畫",
  tinami: "TINAMI",
};

export const nekomaidUserscriptUrl =
  "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/126952-userscript.js";

const r18CookieName = "nekomaid_r18_confirmed";
const r18ConfirmedEventName = "nekomaid:r18-confirmed";

export function itemSite(item: NekomaidArtwork) {
  return String(item.site ?? item.from ?? "");
}

export function artworkPath(item: NekomaidArtwork) {
  return `/nekomaid/${itemSite(item)}/${item.author_id}/${item.artwork_id}`;
}

export function artworkShareUrl(item: NekomaidArtwork) {
  const path = artworkPath(item);
  if (typeof window === "undefined") {
    return `/sns${path}`;
  }
  return `${window.location.origin}/sns${path}`;
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

function hasR18ConfirmedCookie() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${r18CookieName}=1`);
}

export function setR18ConfirmedCookie() {
  if (typeof document === "undefined") {
    return;
  }
  const maxAge = 60 * 60 * 24 * 180;
  document.cookie = `${r18CookieName}=1; max-age=${maxAge}; path=/; SameSite=Lax`;
  window.dispatchEvent(new Event(r18ConfirmedEventName));
}

function subscribeR18Confirmation(callback: () => void) {
  window.addEventListener(r18ConfirmedEventName, callback);
  return () => window.removeEventListener(r18ConfirmedEventName, callback);
}

export function useR18Confirmed() {
  return useSyncExternalStore(
    subscribeR18Confirmation,
    hasR18ConfirmedCookie,
    () => false,
  );
}

export function externalArtworkUrl(item: NekomaidArtwork) {
  if (item.artwork_page) return item.artwork_page;
  const site = itemSite(item);
  if (site === "pixiv")
    return `https://www.pixiv.net/artworks/${item.artwork_id}`;
  if (site === "nico")
    return `https://seiga.nicovideo.jp/seiga/${item.artwork_id}`;
  if (site === "tinami")
    return `https://www.tinami.com/view/${item.artwork_id}`;
  return item.nekomaid_link ?? "";
}

export function externalAuthorUrl(item: NekomaidArtwork) {
  if (item.author_page) return item.author_page;
  const site = itemSite(item);
  if (site === "pixiv") return `https://www.pixiv.net/users/${item.author_id}`;
  if (site === "nico") {
    return `https://seiga.nicovideo.jp/user/illust/${item.author_id}`;
  }
  if (site === "tinami") {
    return `https://www.tinami.com/creator/profile/${item.author_id}`;
  }
  return item.nekomaid_link ?? "";
}

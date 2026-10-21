import { galgamePath } from "@/helpers/galgame.ts";

// 手機底部導覽高度；GalgameLayout 用它保留底部空間，避免內容被蓋住
export const galgameBottomNavHeight = 56;

// 頂部導覽與手機底部導覽共用的主要入口；label 對應 galgame.layout.nav.<key>
export const galgameNavItems = [
  { key: "videos", path: "" },
  { key: "brands", path: "brands" },
  { key: "favorites", path: "favorites" },
] as const;

// 投稿入口收進選單，桌機「＋ 投稿」與手機底部「投稿」共用
export const galgameSubmitItems = [
  { key: "submitChannel", path: "submit" },
  { key: "submitVideo", path: "submit-video" },
] as const;

/** 目前路徑是否落在某個導覽入口；首頁只比對完整路徑，避免所有頁面都亮「影片」 */
export function isGalgameNavActive(pathname: string, path: string) {
  const target = galgamePath(path);
  return path ? pathname.startsWith(target) : pathname === target;
}

import {
  avAdminSubmissionsPath,
  avAdminTopicsPath,
  avAdminVideoSubmissionsPath,
  BACKEND_ADMIN_PATH,
  galgameAdminPath,
} from "@/helpers/backendAdmin.ts";

/** 側欄數字的來源，對應 useBackendAdminPendingCounts 的回傳欄位 */
export type BackendAdminBadge =
  "avSubmissions" | "avVideoSubmissions" | "galgameBrands" | "galgameVideos";

export interface BackendAdminNavItem {
  label: string;
  href: string;
  badge?: BackendAdminBadge;
  /** 外部後台（另開分頁），不參與麵包屑比對 */
  external?: boolean;
}

export interface BackendAdminNavGroup {
  /** 沒有 title 的群組（總覽）側欄不顯示群組標題 */
  title?: string;
  items: BackendAdminNavItem[];
}

/** 整合後台的側欄：之後新的管理功能都加在這裡，麵包屑與總覽卡片也是從這份資料推導 */
export const backendAdminNav: BackendAdminNavGroup[] = [
  { items: [{ label: "總覽", href: BACKEND_ADMIN_PATH }] },
  {
    title: "Galgame",
    items: [
      { label: "頻道管理", href: galgameAdminPath("brands") },
      { label: "影片管理", href: galgameAdminPath("videos") },
      {
        label: "待審頻道",
        href: galgameAdminPath("brand-submissions"),
        badge: "galgameBrands",
      },
      {
        label: "待審影片",
        href: galgameAdminPath("video-submissions"),
        badge: "galgameVideos",
      },
      { label: "影片關鍵字", href: galgameAdminPath("title-keywords") },
    ],
  },
  {
    title: "AV",
    items: [
      {
        label: "女優上稿審核",
        href: avAdminSubmissionsPath,
        badge: "avSubmissions",
      },
      {
        label: "影片修改審核",
        href: avAdminVideoSubmissionsPath,
        badge: "avVideoSubmissions",
      },
      { label: "女優主題", href: avAdminTopicsPath },
    ],
  },
  {
    title: "其他後台",
    // SteamLoom 是獨立的帳號系統與權限（平台 RBAC），不併進來，只放外連
    items: [
      {
        label: "SteamLoom 檢舉後台",
        href: "https://steamloom.works/admin/reports",
        external: true,
      },
    ],
  },
];

/** 找出目前路徑對應的側欄項目（子路徑也算，例如 /av/submissions/12）；總覽只比對完全相等 */
export function findBackendAdminNavMatch(pathname: string) {
  for (const group of backendAdminNav) {
    for (const item of group.items) {
      if (item.external) continue;
      const hit =
        item.href === BACKEND_ADMIN_PATH
          ? pathname === item.href || pathname === `${item.href}/`
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (hit) return { group, item };
    }
  }
  return null;
}

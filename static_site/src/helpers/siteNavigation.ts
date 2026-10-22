import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import type { LayoutDropMenu, LayoutMenuItem } from "@/types/layout.ts";

export interface SiteNavigationMatch {
  group: LayoutDropMenu;
  item: LayoutMenuItem;
}

/**
 * 由目前路徑找出所屬的導覽分類與項目（以 href 前綴比對，子路徑也算）。
 * header 分類高亮、breadcrumb、是否顯示登入入口都共用這個結果。
 */
export function findSiteNavigationMatch(
  pathname: string,
): SiteNavigationMatch | null {
  for (const group of headerNavigationItems.filter(isLayoutDropMenu))
    for (const item of group.items)
      if (
        !item.external &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`))
      )
        return { group, item };
  return null;
}

export type LayoutMenu = LayoutDropMenu[] | LayoutMenuItem[];

export interface LayoutMenuItem {
  title: string;
  href: string;
  external?: boolean;
  description?: string;
  /** 此功能（含子路徑）需要會員登入：header 會顯示登入按鈕／帳號選單 */
  requiresAuth?: boolean;
  /** 功能底下有固定名稱的子頁（例如 VTuber 的電視牆）：breadcrumb 多顯示一層；不會出現在導覽選單裡 */
  subPages?: Pick<LayoutMenuItem, "title" | "href">[];
  /** 登入後帳號選單額外列出的連結（例如該功能的「我的最愛」） */
  accountLinks?: LayoutMenuItem[];
  /** 只有管理者（users.is_admin）看得到，用在帳號選單的管理頁入口 */
  adminOnly?: boolean;
  /** 帳號選單上顯示的待處理數量（見 helpers/accountLinkBadges.ts） */
  badge?: AccountLinkBadge;
}

export type AccountLinkBadge = "avActressSubmissions";

export interface LayoutDropMenu {
  title: string;
  items: LayoutMenuItem[];
}

export type LayoutNavigationItem = LayoutMenuItem | LayoutDropMenu;

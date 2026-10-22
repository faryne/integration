export type LayoutMenu = LayoutDropMenu[] | LayoutMenuItem[];

export interface LayoutMenuItem {
  title: string;
  href: string;
  external?: boolean;
  description?: string;
  /** 此功能（含子路徑）需要會員登入：header 會顯示登入按鈕／帳號選單 */
  requiresAuth?: boolean;
  /** 登入後帳號選單額外列出的連結（例如該功能的「我的最愛」） */
  accountLinks?: LayoutMenuItem[];
}

export interface LayoutDropMenu {
  title: string;
  items: LayoutMenuItem[];
}

export type LayoutNavigationItem = LayoutMenuItem | LayoutDropMenu;

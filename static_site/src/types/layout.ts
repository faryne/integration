export type LayoutMenu = LayoutDropMenu[] | LayoutMenuItem[];

export interface LayoutMenuItem {
  title: string;
  href: string;
  external?: boolean;
}

export interface LayoutDropMenu {
  title: string;
  items: LayoutMenuItem[];
}

export type LayoutNavigationItem = LayoutMenuItem | LayoutDropMenu;

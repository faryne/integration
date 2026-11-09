// joyu.fyi 頁首導覽與麵包屑共用的區塊定義；首頁（/）是入口頁，不屬於任何區塊，不顯示麵包屑
export interface JoyuSection {
  title: string;
  href: string;
  /** 這個區塊涵蓋的路徑（含子路徑），依序比對、先中先贏 */
  match: (pathname: string) => boolean;
}

export const joyuSections: JoyuSection[] = [
  {
    title: "女優主題",
    href: "/actress/topics",
    match: (p) => p.startsWith("/actress/topics"),
  },
  {
    title: "女優",
    href: "/actress",
    match: (p) => p.startsWith("/actress"),
  },
  { title: "影片", href: "/video", match: (p) => p.startsWith("/video") },
  {
    title: "即將發售",
    href: "/upcoming",
    match: (p) => p.startsWith("/upcoming"),
  },
  // 不在頁首導覽裡（從帳號選單進），只用在麵包屑
  {
    title: "我的追蹤",
    href: "/me/follows",
    match: (p) => p.startsWith("/me/follows"),
  },
  {
    title: "我的片單",
    href: "/me/videos",
    match: (p) => p.startsWith("/me/videos"),
  },
  {
    title: "個人資料",
    href: "/me/profile",
    match: (p) => p.startsWith("/me/profile"),
  },
];

// 頁首依顯示順序排（女優、主題、影片、即將發售），比對順序則是 joyuSections（主題要先於女優）
export const joyuNavItems = ["女優", "女優主題", "影片", "即將發售"].map(
  (title) => joyuSections.find((s) => s.title === title)!,
);

export const findJoyuSection = (pathname: string) =>
  joyuSections.find((s) => s.match(pathname));

// 有登記名稱的子頁，麵包屑多一層
export const joyuSubPages: Record<string, string> = {
  "/actress/submit": "新增女優",
};

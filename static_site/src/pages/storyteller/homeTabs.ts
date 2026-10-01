export type StorytellerHomeTab =
  | "project"
  | "notifications"
  | "agent"
  | "apikey"
  | "usage"
  | "pat"
  | "oauth"
  | "mcp"
  | "activity"
  | "favorites"
  | "profile";

export const tabPath: Record<StorytellerHomeTab, string> = {
  project: "projects",
  notifications: "notifications",
  agent: "agent",
  apikey: "api-keys",
  usage: "usage",
  pat: "pat",
  oauth: "oauth",
  mcp: "mcp",
  activity: "activity",
  favorites: "favorites",
  profile: "profile",
};

export const tabBreadcrumbLabel: Record<StorytellerHomeTab, string> = {
  project: "創作專案",
  notifications: "通知",
  agent: "Skill",
  apikey: "金鑰管理",
  usage: "用量報表",
  pat: "Personal Access Token",
  oauth: "OAuth Token",
  mcp: "MCP 連接",
  activity: "活動紀錄",
  favorites: "我的追蹤",
  profile: "我的檔案",
};

export interface StorytellerHomeTabGroup {
  label: string;
  tabs: StorytellerHomeTab[];
}

// 側邊欄的分組——「我的工作台」放創作相關功能，「社群」放對外的身分（我的檔案）、
// 追蹤的作品／作者與通知，「帳號與安全」放登入與憑證的稽核紀錄，
// 「開發者」放外部工具連線用的憑證與 MCP 說明（多數寫作者用不到，所以放最下面），
// 所有群組共用同一份 activeTab／tabPath 機制。
export const homeTabGroups: StorytellerHomeTabGroup[] = [
  { label: "我的工作台", tabs: ["project", "agent", "apikey", "usage"] },
  { label: "社群", tabs: ["profile", "favorites", "notifications"] },
  { label: "帳號與安全", tabs: ["activity"] },
  { label: "開發者", tabs: ["pat", "oauth", "mcp"] },
];

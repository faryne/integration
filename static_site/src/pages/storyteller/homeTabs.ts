export type StorytellerHomeTab =
  | "project"
  | "agent"
  | "apikey"
  | "usage"
  | "mcp"
  | "activity"
  | "favorites"
  | "profile";

export const tabPath: Record<StorytellerHomeTab, string> = {
  project: "projects",
  agent: "agent",
  apikey: "api-keys",
  usage: "usage",
  mcp: "mcp",
  activity: "activity",
  favorites: "favorites",
  profile: "profile",
};

export const tabBreadcrumbLabel: Record<StorytellerHomeTab, string> = {
  project: "創作專案",
  agent: "Skill",
  apikey: "金鑰管理",
  usage: "用量報表",
  mcp: "MCP 連接",
  activity: "活動紀錄",
  favorites: "我的追蹤",
  profile: "我的檔案",
};

export interface StorytellerHomeTabGroup {
  label: string;
  tabs: StorytellerHomeTab[];
}

// 側邊欄的分組——「我的工作台」放創作相關功能、「我的追蹤」放追蹤的作品/作者、
// 「帳號與安全」放登入與憑證的稽核紀錄，「我的檔案」放帳號設定，
// 所有群組共用同一份 activeTab／tabPath 機制。
export const homeTabGroups: StorytellerHomeTabGroup[] = [
  { label: "我的工作台", tabs: ["project", "agent", "apikey", "usage", "mcp"] },
  { label: "帳號與安全", tabs: ["activity"] },
  { label: "我的追蹤", tabs: ["favorites"] },
  { label: "我的檔案", tabs: ["profile"] },
];

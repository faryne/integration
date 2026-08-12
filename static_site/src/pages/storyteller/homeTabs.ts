export type StorytellerHomeTab =
  "project" | "agent" | "apikey" | "usage" | "mcp" | "favorites" | "profile";

export const tabPath: Record<StorytellerHomeTab, string> = {
  project: "projects",
  agent: "agent",
  apikey: "api-keys",
  usage: "usage",
  mcp: "mcp",
  favorites: "favorites",
  profile: "profile",
};

export const tabBreadcrumbLabel: Record<StorytellerHomeTab, string> = {
  project: "創作專案",
  agent: "AI Agent",
  apikey: "金鑰管理",
  usage: "用量報表",
  mcp: "MCP 連接",
  favorites: "我的追蹤",
  profile: "我的檔案",
};

export interface StorytellerHomeTabGroup {
  label: string;
  tabs: StorytellerHomeTab[];
}

// 側邊欄的分組——「我的工作台」放創作相關功能、「我的追蹤」放追蹤的作品/作者、
// 「我的檔案」放帳號設定，三個群組共用同一份 activeTab／tabPath 機制。
export const homeTabGroups: StorytellerHomeTabGroup[] = [
  { label: "我的工作台", tabs: ["project", "agent", "apikey", "usage", "mcp"] },
  { label: "我的追蹤", tabs: ["favorites"] },
  { label: "我的檔案", tabs: ["profile"] },
];

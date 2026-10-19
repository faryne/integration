import { STORYTELLER_AI_ASSISTANT_ENABLED } from "@/data/storyteller.ts";

export type StorytellerHomeTab =
  | "project"
  | "notifications"
  | "blocks"
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
  blocks: "blocks",
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

export const tabBreadcrumbKey = Object.fromEntries(
  Object.keys(tabPath).map((tab) => [tab, `web.home.tabs.${tab}`]),
) as Record<StorytellerHomeTab, string>;

export interface StorytellerHomeTabGroup {
  labelKey: string;
  tabs: StorytellerHomeTab[];
}

// 側邊欄的分組——「我的工作台」放創作相關功能，「社群」放對外的身分（我的檔案）、
// 追蹤的作品／作者與通知，「帳號與安全」放登入與憑證的稽核紀錄，
// 「開發者」放外部工具連線用的憑證與 MCP 說明（多數寫作者用不到，所以放最下面），
// 所有群組共用同一份 activeTab／tabPath 機制。
const allHomeTabGroups: StorytellerHomeTabGroup[] = [
  { labelKey: "web.home.groups.workspace", tabs: ["project", "agent", "apikey", "usage"] },
  { labelKey: "web.home.groups.community", tabs: ["profile", "favorites", "notifications", "blocks"] },
  { labelKey: "web.home.groups.security", tabs: ["activity"] },
  { labelKey: "web.home.groups.developer", tabs: ["pat", "oauth", "mcp"] },
];

// Skill／金鑰管理／用量報表只服務站內 AI 助理，停用時不出現在側欄，網址也轉回創作專案
const aiOnlyTabs: StorytellerHomeTab[] = ["agent", "apikey", "usage"];

export const isStorytellerHomeTabEnabled = (tab: StorytellerHomeTab) =>
  STORYTELLER_AI_ASSISTANT_ENABLED || !aiOnlyTabs.includes(tab);

export const homeTabGroups: StorytellerHomeTabGroup[] = allHomeTabGroups.map(
  (group) => ({
    ...group,
    tabs: group.tabs.filter(isStorytellerHomeTabEnabled),
  }),
);

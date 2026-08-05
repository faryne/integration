export type StorytellerHomeTab =
  "project" | "agent" | "apikey" | "usage" | "mcp";

export const tabPath: Record<StorytellerHomeTab, string> = {
  project: "project",
  agent: "agent",
  apikey: "api-keys",
  usage: "usage",
  mcp: "mcp",
};

export const tabBreadcrumbLabel: Record<StorytellerHomeTab, string> = {
  project: "創作專案",
  agent: "AI Agent",
  apikey: "金鑰管理",
  usage: "用量報表",
  mcp: "MCP 連接",
};

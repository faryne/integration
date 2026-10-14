import type { Workspace } from "@writer/lib/backend.ts";

type Translate = (key: string, values?: Record<string, string>) => string;

const resources: Array<[string, string]> = [
  ["story_versions", "storyVersions"], ["story_version", "storyVersions"],
  ["story_chapters", "storyChapters"], ["story_chapter", "storyChapters"],
  ["lore_collections", "loreCollections"], ["lore_versions", "loreVersions"], ["lore_version", "loreVersions"],
  ["lore_chapters", "loreChapters"], ["lore_chapter", "loreChapters"],
  ["asset_collections", "assetCollections"], ["stories", "stories"], ["story", "story"],
  ["volumes", "volumes"], ["lores", "lores"], ["lore", "lore"], ["assets", "assets"], ["asset", "asset"],
  ["memories", "memories"], ["profiles", "profiles"], ["project", "project"], ["content", "content"],
];

// 三家 Agent 的 MCP tool 名稱格式不同，先抽出一致的 storyteller_* 名稱再顯示。
function canonicalTool(raw: string) {
  return raw.match(/storyteller_(?:get|list|search|validate|upsert|patch|delete|update|revert|insert|replace)_[a-z0-9_]+/gi)?.at(-1)?.toLowerCase() ?? raw;
}

function targetTitle(target: string | undefined, workspace: Workspace) {
  if (!target) return "";
  const volumes = workspace.volumes ?? [];
  const loreCollections = workspace.lore_collections ?? [];
  const items = [
    ...(workspace.ungrouped_stories ?? []),
    ...volumes.flatMap((group) => group.items ?? []),
    ...(workspace.uncategorized_lores ?? []),
    ...loreCollections.flatMap((group) => group.items ?? []),
  ];
  const groups = [...volumes, ...loreCollections, ...(workspace.asset_collections ?? [])];
  return items.find((item) => item.public_id === target)?.title ?? groups.find((group) => group.public_id === target)?.name ?? target;
}

export function agentActivityLabel(raw: string, target: string | undefined, workspace: Workspace, t: Translate) {
  const tool = canonicalTool(raw).replace(/^storyteller_/, "");
  const resource = resources.find(([suffix]) => tool.endsWith(suffix))?.[1] ?? "tool";
  const action = tool === "list_memories" ? "read" : tool.startsWith("get_") ? "read" : tool.startsWith("list_") ? "list" : tool.startsWith("search_") ? "search" : tool.startsWith("validate_") ? "validate" : "run";
  const label = t(`workspace.chat.tools.actions.${action}`, { resource: t(`workspace.chat.tools.resources.${resource}`) });
  const title = targetTitle(target, workspace);
  return title ? `${label}：〈${title}〉` : label;
}

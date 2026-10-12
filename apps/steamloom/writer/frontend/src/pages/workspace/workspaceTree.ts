import type { DocumentItem, Workspace, WorkspaceGroup } from "@/lib/backend.ts";

export type WorkspaceTab = "chat" | "editor" | "history";

// 同一篇文件的判斷：故事與設定的 public_id 可能撞號，要連 kind 一起比
export const isSameDocument = (a: DocumentItem | null, b: DocumentItem) =>
  a?.kind === b.kind && a.public_id === b.public_id;

// 依側邊列順序攤平所有故事（冊內 → 未分冊）
const allStories = (ws: Workspace) => [...(ws.volumes ?? []).flatMap((group) => group.items ?? []), ...(ws.ungrouped_stories ?? [])];

// 進入專案時預設打開的文件：側邊列上第一篇故事，沒有故事就第一篇設定
export function firstDocument(ws: Workspace): DocumentItem | null {
  const lores = [...(ws.lore_collections ?? []).flatMap((group) => group.items ?? []), ...(ws.uncategorized_lores ?? [])];
  return allStories(ws)[0] ?? lores[0] ?? null;
}

// 麵包屑用：文件所在的冊或設定集名稱，未分組時回 null
export function findGroup(ws: Workspace, item: DocumentItem): WorkspaceGroup | null {
  const groups = item.kind === "story" ? ws.volumes : ws.lore_collections;
  return (groups ?? []).find((group) => (group.items ?? []).some((each) => isSameDocument(each, item))) ?? null;
}

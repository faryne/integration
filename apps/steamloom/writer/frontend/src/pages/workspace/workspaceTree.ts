import type { DocumentItem, Workspace, WorkspaceGroup } from "@/lib/backend.ts";

export type DocumentTab = "editor" | "history";

// 同一篇文件的判斷：故事與設定的 public_id 可能撞號，要連 kind 一起比
export const isSameDocument = (a: DocumentItem | null, b: DocumentItem) =>
  a?.kind === b.kind && a.public_id === b.public_id;

// 麵包屑用：文件所在的冊或設定集名稱，未分組時回 null
export function findGroup(ws: Workspace, item: DocumentItem): WorkspaceGroup | null {
  const groups = item.kind === "story" ? ws.volumes : ws.lore_collections;
  return (groups ?? []).find((group) => (group.items ?? []).some((each) => isSameDocument(each, item))) ?? null;
}

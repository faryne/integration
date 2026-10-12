import type { DocumentItem, Workspace, WorkspaceGroup } from "@writer/lib/backend.ts";

export type DocumentTab = "editor" | "history";

// 同一篇文件的判斷：故事與設定的 public_id 可能撞號，要連 kind 一起比
export const isSameDocument = (a: DocumentItem | null, b: DocumentItem) =>
  a?.kind === b.kind && a.public_id === b.public_id;

// 麵包屑用：文件所在的冊或設定集名稱，未分組時回 null
export function findGroup(ws: Workspace, item: DocumentItem): WorkspaceGroup | null {
  const groups = item.kind === "story" ? ws.volumes : ws.lore_collections;
  return (groups ?? []).find((group) => (group.items ?? []).some((each) => isSameDocument(each, item))) ?? null;
}

// 文件所在分組（冊／設定集）的 public_id，未分冊／未歸類回空字串
export const groupIdOf = (ws: Workspace, item: DocumentItem) => findGroup(ws, item)?.public_id ?? "";

// 「移動到冊／設定集」與編輯頁屬性列共用的選項；publicId 空字串＝未分冊／未歸類（固定排第一個）
export type MoveTarget = { publicId: string; name: string };
export const groupTargets = (ws: Workspace, kind: DocumentItem["kind"], ungroupedName: string): MoveTarget[] => [
  { publicId: "", name: ungroupedName },
  ...((kind === "story" ? ws.volumes : ws.lore_collections) ?? []).map((group) => ({ publicId: group.public_id, name: group.name })),
];

// 把 list[index] 往前（-1）或往後（+1）移一格，回傳新陣列；排序模式的上移／下移用
export function moveInList<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

import type {
  StorytellerAsset,
  StorytellerLore,
  StorytellerStory,
} from "@/types/storyteller.ts";

export type WorkspaceSection = "stories" | "lores" | "assets";
export type SelectedNode = { section: WorkspaceSection; collectionId: string };
export type SelectedItem =
  | { type: "story"; row: StorytellerStory }
  | { type: "lore"; row: StorytellerLore }
  | { type: "asset"; row: StorytellerAsset };

export const ungroupedId = "__ungrouped__";

export function nodeTitle(section: WorkspaceSection, collectionId: string) {
  if (collectionId === "") {
    return section === "stories"
      ? "全部作品"
      : section === "lores"
        ? "全部設定"
        : "全部資產";
  }
  if (collectionId === ungroupedId) {
    return section === "stories" ? "未分冊" : "未分類";
  }
  return "";
}

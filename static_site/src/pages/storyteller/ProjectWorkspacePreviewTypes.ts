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

// 設定集／資產集查詢 API 用來篩選「只要未分類」的專屬 sentinel（對應後端
// loreCollectionUncategorized／assetCollectionUncategorized 常數），跟前端路由用的
// ungroupedId 是兩個不同語意的字串，呼叫 API 前要轉換，不能直接送空字串——
// 空字串在後端代表「不篩選 collection_id」（回全部），不是「只要未分類」，兩者結果
// 差很多（未分類清單會混進所有已分類的項目）。
export const backendUncategorizedFilterId = "__uncategorized__";

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

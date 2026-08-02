import type { StorytellerAsset } from "@/types/storyteller.ts";

export function storytellerAssetTitle(asset: StorytellerAsset) {
  return asset.title || asset.original_filename || "未命名資產";
}

export function storytellerAssetMarkdown(asset: StorytellerAsset) {
  const alt = (asset.alt_text || storytellerAssetTitle(asset))
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replace(/[\n\r]/g, " ");
  return `![${alt}](steamloom-asset://${asset.public_id})`;
}

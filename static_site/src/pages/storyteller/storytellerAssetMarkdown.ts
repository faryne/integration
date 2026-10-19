import i18n from "i18next";
import type { StorytellerAsset } from "@/types/storyteller.ts";
import {
  ASSET_URI_PREFIX,
  sanitizeMarkdownImageAlt,
} from "./wysiwygCore/whitelist";

export function storytellerAssetTitle(
  asset: Pick<StorytellerAsset, "title" | "original_filename">,
) {
  // 非元件 helper，用全域 i18next
  return (
    asset.title ||
    asset.original_filename ||
    i18n.t("web.assetManager.untitled")
  );
}

export function storytellerAssetMarkdown(
  asset: Pick<
    StorytellerAsset,
    "title" | "original_filename" | "alt_text" | "public_id"
  >,
) {
  const alt = sanitizeMarkdownImageAlt(
    asset.alt_text || storytellerAssetTitle(asset),
  );
  return `![${alt}](${ASSET_URI_PREFIX}${asset.public_id})`;
}

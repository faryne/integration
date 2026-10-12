import type { StorytellerEditorData } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { useStorytellerAsset } from "./asset.ts";
import { useStorytellerLores } from "./lore.ts";

// 網站版編輯器的資料來源：直接沿用 react-query hook（快取、資產網址定時刷新都照舊）
export const webEditorData: StorytellerEditorData = {
  useLores: useStorytellerLores,
  useAsset: (projectPublicId, assetPublicId) =>
    useStorytellerAsset(projectPublicId, assetPublicId),
};

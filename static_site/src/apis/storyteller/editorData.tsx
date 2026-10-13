import { Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type { StorytellerEditorData } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { useStorytellerAsset, useStorytellerAssets } from "./asset.ts";
import { useStorytellerLores } from "./lore.ts";

// 網站版編輯器的資料來源：直接沿用 react-query hook（快取、資產網址定時刷新都照舊）
export const webEditorData: StorytellerEditorData = {
  useLores: useStorytellerLores,
  useAsset: (projectPublicId, assetPublicId) =>
    useStorytellerAsset(projectPublicId, assetPublicId),
  useAssets: (projectPublicId, page, pageSize, keyword) =>
    useStorytellerAssets(projectPublicId, page, pageSize, keyword),
  // 資產選擇對話框沒有資產時，另開分頁到工作台的資產集上傳
  assetUploadAction: (projectPublicId) => (
    <Button
      component={RouterLink}
      to={steamloomPath(`my/workspace/${projectPublicId}/assets`)}
      target="_blank"
      rel="noopener"
      size="small"
      variant="outlined"
    >
      前往資產集上傳
    </Button>
  ),
};

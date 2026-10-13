import axios from "axios";
import {
  useDeleteStorytellerAsset,
  useMoveStorytellerAsset,
  useUpdateStorytellerAsset,
} from "@/apis/storyteller.ts";
import { AssetDetailPanel } from "./WorkspaceAssetPanel.tsx";
import type {
  StorytellerAsset,
  StorytellerAssetCollection,
} from "@/types/storyteller.ts";

// 網站版資產詳細面板：共用的 AssetDetailPanel 接上 react-query（Writer 那邊接 Go 綁定）。
export function WorkspaceAssetPanel({
  asset,
  assetCollections,
  projectId,
  onDeleted,
}: {
  asset: StorytellerAsset;
  assetCollections: StorytellerAssetCollection[];
  projectId: string;
  onDeleted: () => void;
}) {
  const updateAsset = useUpdateStorytellerAsset(projectId);
  const moveAsset = useMoveStorytellerAsset(projectId);
  const deleteAsset = useDeleteStorytellerAsset(projectId);
  return (
    <AssetDetailPanel
      asset={asset}
      assetCollections={assetCollections}
      onUpdate={(input) =>
        updateAsset.mutateAsync({ assetPublicId: asset.public_id, input })
      }
      onMove={(collectionId) =>
        moveAsset.mutateAsync({ assetPublicId: asset.public_id, collectionId })
      }
      onDelete={() =>
        deleteAsset.mutateAsync(asset.public_id).catch((error: unknown) => {
          // 後端的錯誤訊息（例如仍被引用）直接顯示給作者
          throw new Error(
            axios.isAxiosError(error)
              ? (error.response?.data as { message?: string } | undefined)
                  ?.message || "資產刪除失敗，請重試。"
              : "資產刪除失敗，請重試。",
          );
        })
      }
      onDeleted={onDeleted}
    />
  );
}

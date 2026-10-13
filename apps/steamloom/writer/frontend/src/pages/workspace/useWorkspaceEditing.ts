import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type Workspace } from "@writer/lib/backend.ts";
import { SessionExpiredContext } from "@writer/lib/useBackendData.ts";
import { moveInList } from "@writer/pages/workspace/workspaceTree.ts";

// 側邊列的建立、移動、排序。排序先在畫面上換好順序（不用等 API），再送出；
// 不管成功或失敗都重新抓一次工作台，以伺服器為準（例如中途某一筆失敗、順序一半新一半舊）。
export function useWorkspaceEditing({
  project,
  workspace,
  setWorkspace,
  reload,
}: {
  project: string;
  workspace: Workspace;
  setWorkspace: (ws: Workspace) => void;
  reload: () => void;
}) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const onSessionExpired = useContext(SessionExpiredContext);
  const fail = (err: unknown) => (isNotLoggedIn(err) ? onSessionExpired() : showError(errorMessage(err)));

  const reorder = (kind: string, ids: string[], optimistic: Workspace) => {
    setWorkspace(optimistic);
    backend.Reorder(project, kind, ids).catch(fail).finally(reload);
  };

  return {
    moveVolume: (index: number, delta: -1 | 1) => {
      const volumes = moveInList(workspace.volumes ?? [], index, delta);
      reorder("volumes", volumes.map((volume) => volume.public_id), { ...workspace, volumes });
    },
    // groupId 是冊的 public_id，空字串代表未分冊；故事只在同一冊內排序，跨冊走「移動到冊」
    moveStory: (groupId: string, index: number, delta: -1 | 1) => {
      if (groupId === "") {
        const ungrouped = moveInList(workspace.ungrouped_stories ?? [], index, delta);
        reorder("stories", ungrouped.map((item) => item.public_id), { ...workspace, ungrouped_stories: ungrouped });
        return;
      }
      const volumes = (workspace.volumes ?? []).map((volume) =>
        volume.public_id === groupId ? { ...volume, items: moveInList(volume.items ?? [], index, delta) } : volume,
      );
      const items = volumes.find((volume) => volume.public_id === groupId)?.items ?? [];
      reorder("stories", items.map((item) => item.public_id), { ...workspace, volumes });
    },
    moveLoreCollection: (index: number, delta: -1 | 1) => {
      const collections = moveInList(workspace.lore_collections ?? [], index, delta);
      reorder("lore-collections", collections.map((collection) => collection.public_id), { ...workspace, lore_collections: collections });
    },
    moveStoryTo: (story: string, volume: string) => backend.MoveStory(project, story, volume).catch(fail).finally(reload),
    moveLoreTo: (lore: string, collection: string) => backend.MoveLore(project, lore, collection).catch(fail).finally(reload),
    // 上傳資產：回傳 true 代表有上傳（對話框可關），使用者在選檔視窗取消則回 false；略過的檔案跳 snack 說明原因
    upload: async (collection: string) => {
      try {
        const result = await backend.UploadAssets(project, collection);
        if (!result) return false;
        reload();
        if (result.skipped?.length) showError(t("workspace.upload.skipped", { count: result.skipped.length }));
        return true;
      } catch (err) {
        fail(err);
        reload();
        return false;
      }
    },
    // 成功回傳新項目，失敗回 null（已跳 snack），讓對話框決定要不要關
    create: async (kind: string, name: string, group: string) => {
      try {
        const created = await backend.Create(project, { kind, name, group_public_id: group });
        reload();
        return created;
      } catch (err) {
        fail(err);
        return null;
      }
    },
  };
}

import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { MoveMenu } from "@/pages/storyteller/ProjectWorkspacePreviewActionParts.tsx";
import { WorkspaceRowActionMenu } from "@/pages/storyteller/ProjectWorkspaceRowActions.tsx";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type WorkspaceGroup } from "@writer/lib/backend.ts";
import { SessionExpiredContext } from "@writer/lib/useBackendData.ts";

// ⋮ 選單操作的對象：group_id 是所在冊／設定集的 public_id（空字串＝未分冊／未歸類）
export type RowActionTarget = { kind: string; public_id: string; title: string; content_type: string; status?: string; group_id: string };
// 關閉時只清 anchorEl、保留 target：選單淡出期間文字（冊／設定集、有沒有公開狀態）不會跳成別種
type Anchored = { anchorEl: HTMLElement | null; target: RowActionTarget };
const close = (value: Anchored | null) => value && { ...value, anchorEl: null };

// 作品／設定的 ⋮ 選單（作品：公開狀態、移動到冊、刪除；設定：移動到設定集、刪除），連同它開出來的移動選單與刪除確認。
// 「全部作品／全部設定」列表與側邊列共用，兩邊點開是同一份選單，也跟網站工作台一致。
// 呼叫端用 open() 打開選單，並把 dialogs 放進畫面；寫入成功後呼叫 onChanged（外層重抓），刪除成功另外通知 onDeleted。
export function useDocumentRowActions({
  project,
  groupsOf,
  onChanged,
  onDeleted,
}: {
  project: string;
  // 可移動到的冊（kind=story）／設定集（kind=lore）
  groupsOf: (kind: string) => WorkspaceGroup[];
  onChanged: () => void;
  onDeleted?: (target: RowActionTarget) => void;
}) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const onSessionExpired = useContext(SessionExpiredContext);
  const [menu, setMenu] = useState<Anchored | null>(null);
  const [moving, setMoving] = useState<Anchored | null>(null);
  const [deleting, setDeleting] = useState<RowActionTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const menuKind = menu?.target.kind ?? "story";
  const movingKind = moving?.target.kind ?? "story";
  const closeMenu = () => setMenu(close);

  // 包住每個寫入操作：成功跳 snack 並讓外層重抓，失敗跳錯誤訊息；回傳是否成功
  const run = async (promise: Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await promise;
      showSuccess(success);
      onChanged();
      return true;
    } catch (err) {
      if (isNotLoggedIn(err)) onSessionExpired();
      else showError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const dialogs = (
    <>
      <WorkspaceRowActionMenu
        anchorEl={menu?.anchorEl ?? null}
        moveLabel={t(`workspace.list.move.${menuKind}`)}
        deleteLabel={t(`workspace.list.delete.${menuKind}`)}
        status={menu && menuKind === "story" ? (menu.target.status === "completed" ? "completed" : "draft") : undefined}
        disabled={busy}
        onClose={closeMenu}
        onToggleStatus={() => {
          if (!menu) return;
          const { kind, public_id, status } = menu.target;
          const next = status === "completed" ? "draft" : "completed";
          closeMenu();
          void run(backend.PatchDocument(project, kind, public_id, { status: next }), t(next === "completed" ? "workspace.list.published" : "workspace.list.unpublished"));
        }}
        onMove={() => {
          if (menu) setMoving(menu);
          closeMenu();
        }}
        onDelete={() => {
          setDeleting(menu?.target ?? null);
          closeMenu();
        }}
      />
      <MoveMenu
        anchorEl={moving?.anchorEl ?? null}
        open={Boolean(moving?.anchorEl)}
        disabled={busy}
        currentId={moving?.target.group_id ?? ""}
        rows={groupsOf(movingKind).map((group) => ({ id: group.public_id, publicId: group.public_id, name: group.name }))}
        ungroupedLabel={t(`workspace.list.moveToUngrouped.${movingKind}`)}
        onClose={() => setMoving(close)}
        onMove={(group) => {
          if (!moving) return;
          const id = moving.target.public_id;
          setMoving(close);
          void run(movingKind === "story" ? backend.MoveStory(project, id, group) : backend.MoveLore(project, id, group), t(`workspace.list.moved.${movingKind}`));
        }}
      />
      {deleting && (
        <StorytellerConfirmNameDialog
          open
          title={t(`workspace.list.delete.${deleting.content_type === "image" ? "image" : deleting.kind}`)}
          description={t(`workspace.list.deleteDescription.${deleting.kind}`)}
          confirmName={deleting.title}
          confirmLabel={t(`workspace.list.delete.${deleting.kind}`)}
          loading={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (await run(backend.DeleteDocument(project, deleting.kind, deleting.public_id), t(`workspace.list.deleted.${deleting.kind}`))) {
              onDeleted?.(deleting);
              setDeleting(null);
            }
          }}
        />
      )}
    </>
  );

  return { open: (anchorEl: HTMLElement, target: RowActionTarget) => setMenu({ anchorEl, target }), dialogs };
}

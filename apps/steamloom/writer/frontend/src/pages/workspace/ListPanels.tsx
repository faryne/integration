import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { WorkspaceEmptyState } from "@/components/storyteller/WorkspaceEmptyState.tsx";
import { MoveMenu } from "@/pages/storyteller/ProjectWorkspacePreviewActionParts.tsx";
import { WorkspaceRowActionButton, WorkspaceRowActionMenu } from "@/pages/storyteller/ProjectWorkspaceRowActions.tsx";
import { LoreRow, StoryRow } from "@/pages/storyteller/WorkspaceDocumentRows.tsx";
import ArticleIcon from "@mui/icons-material/Article";
import FolderIcon from "@mui/icons-material/Folder";
import { Box, Chip, CircularProgress, Stack } from "@mui/material";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type DocumentItem, type ListedDocument, type WorkspaceGroup } from "@writer/lib/backend.ts";
import { SessionExpiredContext, useBackendData } from "@writer/lib/useBackendData.ts";

export type ListSection = "stories" | "lores" | "assets";

// 「全部作品／全部設定」：版面與操作比照網站工作台列表——列用網站的 StoryRow／LoreRow，
// 右側 ⋮ 是網站同一個選單（作品：公開狀態、移動到冊、刪除；設定：移動到設定集、刪除），
// 點列本身打開編輯頁。混合列表標出每一列所屬的冊／設定集。version 變動（建立、移動、排序之後）就重新抓。
export function DocumentListPanel({
  project,
  kind,
  groups,
  version,
  onOpen,
  onChanged,
}: {
  project: string;
  kind: "story" | "lore";
  // 可移動到的冊／設定集
  groups: WorkspaceGroup[];
  version: number;
  onOpen: (item: DocumentItem) => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const onSessionExpired = useContext(SessionExpiredContext);
  const rows = useBackendData(() => backend.ListDocuments(project, kind), [project, kind, version]);
  const [menu, setMenu] = useState<{ anchorEl: HTMLElement; row: ListedDocument } | null>(null);
  const [moving, setMoving] = useState<{ anchorEl: HTMLElement; row: ListedDocument } | null>(null);
  const [deleting, setDeleting] = useState<ListedDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const isStory = kind === "story";

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

  if (rows === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  return (
    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
      {!rows?.length && <WorkspaceEmptyState icon={<ArticleIcon />} title={t(`workspace.list.empty.${kind}.title`)} description={t(`workspace.list.empty.${kind}.description`)} />}
      <Stack>
        {(rows ?? []).map((row) => {
          const open = () => onOpen({ kind: row.kind, public_id: row.public_id, title: row.title, content_type: row.content_type });
          const chip = row.group_name && <Chip size="small" variant="outlined" icon={<FolderIcon fontSize="small" />} label={row.group_name} sx={{ height: 22, borderRadius: 1, fontWeight: 700 }} />;
          const actions = <WorkspaceRowActionButton label={t(`workspace.list.actions.${kind}`)} onOpen={(event) => setMenu({ anchorEl: event.currentTarget, row })} />;
          const status = row.status === "completed" ? "completed" : "draft";
          return isStory ? (
            <StoryRow
              key={row.public_id}
              // Go 回傳的 content_type 是 string，收窄成網站的型別
              story={{ ...row, status, content_type: row.content_type === "image" ? "image" : "text", latest_content: row.latest_content ?? "" }}
              onClick={open}
              actions={actions}
              collectionChip={chip}
            />
          ) : (
            <LoreRow key={row.public_id} lore={{ ...row, status }} onClick={open} actions={actions} collectionChip={chip} />
          );
        })}
      </Stack>
      <WorkspaceRowActionMenu
        anchorEl={menu?.anchorEl ?? null}
        moveLabel={t(`workspace.list.move.${kind}`)}
        deleteLabel={t(`workspace.list.delete.${kind}`)}
        status={isStory && menu ? (menu.row.status === "completed" ? "completed" : "draft") : undefined}
        disabled={busy}
        onClose={() => setMenu(null)}
        onToggleStatus={() => {
          if (!menu) return;
          const next = menu.row.status === "completed" ? "draft" : "completed";
          setMenu(null);
          void run(backend.PatchDocument(project, kind, menu.row.public_id, { status: next }), t(next === "completed" ? "workspace.list.published" : "workspace.list.unpublished"));
        }}
        onMove={() => {
          if (menu) setMoving(menu);
          setMenu(null);
        }}
        onDelete={() => {
          setDeleting(menu?.row ?? null);
          setMenu(null);
        }}
      />
      <MoveMenu
        anchorEl={moving?.anchorEl ?? null}
        open={Boolean(moving)}
        disabled={busy}
        currentId={moving?.row.group_id ?? ""}
        rows={groups.map((group) => ({ id: group.public_id, publicId: group.public_id, name: group.name }))}
        ungroupedLabel={t(`workspace.list.moveToUngrouped.${kind}`)}
        onClose={() => setMoving(null)}
        onMove={(target) => {
          if (!moving) return;
          const id = moving.row.public_id;
          setMoving(null);
          void run(isStory ? backend.MoveStory(project, id, target) : backend.MoveLore(project, id, target), t(`workspace.list.moved.${kind}`));
        }}
      />
      {deleting && (
        <StorytellerConfirmNameDialog
          open
          title={t(`workspace.list.delete.${deleting.content_type === "image" ? "image" : kind}`)}
          description={t(`workspace.list.deleteDescription.${kind}`)}
          confirmName={deleting.title}
          confirmLabel={t(`workspace.list.delete.${kind}`)}
          loading={busy}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (await run(backend.DeleteDocument(project, kind, deleting.public_id), t(`workspace.list.deleted.${kind}`))) setDeleting(null);
          }}
        />
      )}
    </Box>
  );
}

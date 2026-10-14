import { WorkspaceEmptyState } from "@/components/storyteller/WorkspaceEmptyState.tsx";
import { WorkspaceRowActionButton } from "@/pages/storyteller/ProjectWorkspaceRowActions.tsx";
import { LoreRow, StoryRow } from "@/pages/storyteller/WorkspaceDocumentRows.tsx";
import ArticleIcon from "@mui/icons-material/Article";
import FolderIcon from "@mui/icons-material/Folder";
import { Box, Chip, CircularProgress, Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { backend, type DocumentItem, type WorkspaceGroup } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { useDocumentRowActions } from "@writer/pages/workspace/useDocumentRowActions.tsx";

export type ListSection = "stories" | "lores" | "assets" | "memories";

// 「全部作品／全部設定」：版面與操作比照網站工作台列表——列用網站的 StoryRow／LoreRow，
// 右側 ⋮ 是網站同一個選單（見 useDocumentRowActions，側邊列也用同一份），
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
  const rows = useBackendData(() => backend.ListDocuments(project, kind), [project, kind, version]);
  const rowActions = useDocumentRowActions({ project, groupsOf: () => groups, onChanged });
  const isStory = kind === "story";

  if (rows === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  return (
    <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
      {!rows?.length && <WorkspaceEmptyState icon={<ArticleIcon />} title={t(`workspace.list.empty.${kind}.title`)} description={t(`workspace.list.empty.${kind}.description`)} />}
      <Stack>
        {(rows ?? []).map((row) => {
          const open = () => onOpen({ kind: row.kind, public_id: row.public_id, title: row.title, content_type: row.content_type });
          const chip = row.group_name && <Chip size="small" variant="outlined" icon={<FolderIcon fontSize="small" />} label={row.group_name} sx={{ height: 22, borderRadius: 1, fontWeight: 700 }} />;
          const actions = <WorkspaceRowActionButton label={t(`workspace.list.actions.${kind}`)} onOpen={(event) => rowActions.open(event.currentTarget, row)} />;
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
      {rowActions.dialogs}
    </Box>
  );
}

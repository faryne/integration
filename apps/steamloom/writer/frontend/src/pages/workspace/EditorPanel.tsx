import { WorkspaceEmptyState } from "@/components/storyteller/WorkspaceEmptyState.tsx";
import { usePrimaryShortcut } from "@/helpers/shortcut.ts";
import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorMultiSelectButton,
  WorkspaceEditorSaveButton,
  WorkspaceEditorSelectButton,
  WorkspaceEditorStatusInfo,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { useEditorLores } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { publishLoreLinkWarning } from "@/pages/storyteller/storytellerLoreLinkCheck.ts";
import { StoryWritingWorkspace } from "@/pages/storyteller/StoryWritingWorkspace.tsx";
import { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import { contentWordCount } from "@/pages/storyteller/storytellerContentWordCount.ts";
import { publicationStatusOptions } from "@/pages/storyteller/workspaceEditorOptions.ts";
import { editorStatusItems } from "@/pages/storyteller/workspaceEditorStatusItems.tsx";
import CollectionsIcon from "@mui/icons-material/Collections";
import FolderIcon from "@mui/icons-material/Folder";
import PersonIcon from "@mui/icons-material/Person";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StorytellerLore } from "@/types/storyteller.ts";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, type Document, type DocumentItem, type Profile } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { EditorAutoSaveButton, initialAutoSaveMinutes } from "@writer/pages/workspace/EditorAutoSaveButton.tsx";
import { useDocumentDraft } from "@writer/pages/workspace/useDocumentDraft.ts";
import type { MoveTarget } from "@writer/pages/workspace/workspaceTree.ts";

type Props = {
  project: string;
  item: DocumentItem;
  // 所在冊／設定集的 public_id（空字串＝未分冊／未歸類）與可選的冊／設定集（第一個是未分冊／未歸類）
  groupId: string;
  groupTargets: MoveTarget[];
  profile: Profile | null;
  // 有沒有未存檔內容，外層據此在換文件、離開專案前先問
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onShowHistory: () => void;
};

// 編輯分頁：直接用網站的所見即所得編輯器（右鍵選單、slash 指令、浮動工具列、表格、腳注…全部一致），
// 外框（標題、屬性列、摘要、底部狀態列與存檔按鈕）也用網站工作台內嵌編輯頁的同一組元件。
// 狀態、冊／設定集、署名跟網站一樣是草稿的一部分，按存檔才生效；圖像作品的編輯器（網站的 ImageEpisodeEditor）之後再接。
export function EditorPanel(props: Props) {
  const { t } = useTranslation();
  const { project, item } = props;
  const doc = useBackendData(() => backend.Document(project, item.kind, item.public_id), [project, item.kind, item.public_id]);
  if (doc === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  if (!doc) return null;
  if (doc.content_type === "image") {
    return (
      <Box sx={{ flex: 1, p: 3 }}>
        <WorkspaceEmptyState icon={<CollectionsIcon />} title={t("workspace.editor.image.title")} description={t("workspace.editor.image.description")} />
      </Box>
    );
  }
  return <DocumentEditor {...props} doc={doc} />;
}

function DocumentEditor({ project, item, doc, groupId, groupTargets, profile, onDirtyChange, onSaved, onShowHistory }: Props & { doc: Document }) {
  const { t } = useTranslation();
  const { showWarning } = useSnack();
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => initialAutoSaveMinutes(profile));
  const { draft, setDraft, setContent, dirty, saving, updatedAt, conflict, dismissConflict, save } = useDocumentDraft({ project, item, doc, groupId, autoSaveMinutes, onSaved });
  const { data: lores } = useEditorLores(project);
  const wordCount = useMemo(() => contentWordCount(draft.content), [draft.content]);
  const isStory = item.kind === "story";
  const status = publicationStatusOptions.find((option) => option.value === draft.status) ?? publicationStatusOptions[0];
  const groupOptions = groupTargets.map((target) => ({ value: target.publicId, label: target.name, icon: <FolderIcon fontSize="small" /> }));
  // 署名選項比照網站：本人（筆名）＋其他筆名
  const profileOptions = [
    { value: "0", label: profile?.pen_name ? t("workspace.editor.self", { penName: profile.pen_name }) : t("workspace.editor.selfOnly") },
    ...(profile?.profiles ?? []).map((each) => ({ value: String(each.id), label: each.pen_name })),
  ].map((option) => ({ ...option, icon: <PersonIcon fontSize="small" /> }));
  const changeStatus = (next: string) => {
    setDraft({ status: next });
    // 公開時提醒：內文連到還沒公開或已刪除的設定（不擋存檔）；只用到 public_id／title／status
    const warning = next === "completed" ? publishLoreLinkWarning(draft.content, (lores ?? []) as StorytellerLore[]) : undefined;
    if (warning) showWarning(warning);
  };

  usePrimaryShortcut("s", () => void save());
  useEffect(() => onDirtyChange(dirty), [dirty]);
  useEffect(() => () => onDirtyChange(false), []);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", px: 2.5, pt: 1.5 }}>
      <Stack spacing={1.25} sx={{ flex: "none", width: 1, maxWidth: 920, mx: "auto", pb: 1 }}>
        {conflict && (
          <Alert
            severity="warning"
            variant="outlined"
            onClose={dismissConflict}
            action={
              <Button
                size="small"
                onClick={() => {
                  dismissConflict();
                  onShowHistory();
                }}
              >
                {t("workspace.editor.conflict.viewHistory")}
              </Button>
            }
          >
            {t(`workspace.editor.conflict.${item.kind}`)}
          </Alert>
        )}
        <WorkspaceEditorHeaderRow
          title={<WorkspaceEditableTitle value={draft.title} onChange={(title) => setDraft({ title })} placeholder={t(`workspace.editor.titlePlaceholder.${item.kind}`)} />}
        />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <WorkspaceEditorSelectButton icon={status.icon} label={t("workspace.editor.status")} value={draft.status} options={publicationStatusOptions} onChange={changeStatus} />
          {/* 沒有冊／設定集（只剩未分冊／未歸類）、沒有其他筆名時沒得選，停用 */}
          <WorkspaceEditorSelectButton
            icon={<FolderIcon fontSize="small" />}
            label={t(`workspace.editor.group.${item.kind}`)}
            value={draft.groupId}
            options={groupOptions}
            disabled={groupOptions.length <= 1}
            onChange={(next) => setDraft({ groupId: next })}
          />
          {isStory && (
            <WorkspaceEditorMultiSelectButton
              icon={<PersonIcon fontSize="small" />}
              label={t("workspace.editor.authors")}
              values={draft.profileIds.map(String)}
              options={profileOptions}
              disabled={profileOptions.length <= 1}
              onChange={(values) => setDraft({ profileIds: values.map(Number) })}
            />
          )}
          <EditorAutoSaveButton minutes={autoSaveMinutes} onChange={setAutoSaveMinutes} />
        </Stack>
        <WorkspaceEditableSummary value={draft.summary} onChange={(summary) => setDraft({ summary })} placeholder={t(`workspace.editor.summaryPlaceholder.${item.kind}`)} />
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, pb: 1.5 }}>
        <StoryWritingWorkspace
          fillHeight
          editor={
            <StorytellerWysiwygEditor
              value={draft.content}
              onChange={setContent}
              toolbarPlacement="bottom"
              fitParentHeight
              bottomStatusContent={<WorkspaceEditorStatusInfo items={editorStatusItems({ wordCount, updatedAt, autoSaveMinutes })} />}
              bottomActionContent={<WorkspaceEditorSaveButton pending={saving} disabled={saving} onClick={() => void save()} />}
              exportBaseName={draft.title}
              projectPublicId={project}
            />
          }
        />
      </Box>
    </Box>
  );
}

import { WorkspaceEmptyState } from "@/components/storyteller/WorkspaceEmptyState.tsx";
import { usePrimaryShortcut } from "@/helpers/shortcut.ts";
import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorSaveButton,
  WorkspaceEditorSelectButton,
  WorkspaceEditorStatusInfo,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
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
import { backend, type Document, type DocumentItem, type Profile } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { EditorAutoSaveButton, initialAutoSaveMinutes } from "@writer/pages/workspace/EditorAutoSaveButton.tsx";
import { useDocumentDraft } from "@writer/pages/workspace/useDocumentDraft.ts";

type Props = {
  project: string;
  item: DocumentItem;
  // 所在冊／設定集的名稱（未分冊、未歸類也已換成對應文字）
  groupName: string;
  profile: Profile | null;
  // 有沒有未存檔內容，外層據此在換文件、離開專案前先問
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onShowHistory: () => void;
};

// 編輯分頁：直接用網站的所見即所得編輯器（右鍵選單、slash 指令、浮動工具列、表格、腳注…全部一致），
// 外框（標題、屬性列、摘要、底部狀態列與存檔按鈕）也用網站工作台內嵌編輯頁的同一組元件。
// 狀態、冊／設定集、署名第一階段只顯示不給改；圖像作品的編輯器（網站的 ImageEpisodeEditor）之後再接。
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

function DocumentEditor({ project, item, doc, groupName, profile, onDirtyChange, onSaved, onShowHistory }: Props & { doc: Document }) {
  const { t } = useTranslation();
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => initialAutoSaveMinutes(profile));
  const { draft, setDraft, setContent, dirty, saving, updatedAt, conflict, dismissConflict, save } = useDocumentDraft({ project, item, doc, autoSaveMinutes, onSaved });
  const wordCount = useMemo(() => contentWordCount(draft.content), [draft.content]);
  const isStory = item.kind === "story";
  const status = publicationStatusOptions.find((option) => option.value === doc.status) ?? publicationStatusOptions[0];
  const authors = (doc.authors ?? []).map((author) => author.pen_name).join("、");
  // 只顯示用的屬性按鈕：選項就是目前的值，按鈕停用
  const readonly = (value: string) => ({ value, options: [{ value, label: value }], disabled: true, onChange: () => {} });

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
          <WorkspaceEditorSelectButton icon={status.icon} label={t("workspace.editor.status")} {...readonly(status.label)} />
          <WorkspaceEditorSelectButton icon={<FolderIcon fontSize="small" />} label={t(`workspace.editor.group.${item.kind}`)} {...readonly(groupName)} />
          {isStory && authors && <WorkspaceEditorSelectButton icon={<PersonIcon fontSize="small" />} label={t("workspace.editor.authors")} {...readonly(authors)} />}
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

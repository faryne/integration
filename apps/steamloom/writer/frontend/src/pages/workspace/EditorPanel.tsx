import { WorkspaceEditorSaveButton, WorkspaceEditorStatusInfo } from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { StoryWritingWorkspace } from "@/pages/storyteller/StoryWritingWorkspace.tsx";
import { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import { contentWordCount } from "@/pages/storyteller/storytellerContentWordCount.ts";
import { editorStatusItems } from "@/pages/storyteller/workspaceEditorStatusItems.tsx";
import { Box, CircularProgress } from "@mui/material";
import { useMemo, useState } from "react";
import { backend, type Document, type DocumentItem, type Profile } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { DocumentHeader } from "@writer/pages/workspace/DocumentHeader.tsx";
import { EditorAutoSaveButton, initialAutoSaveMinutes } from "@writer/pages/workspace/EditorAutoSaveButton.tsx";
import { ImageDocumentEditor } from "@writer/pages/workspace/ImageDocumentEditor.tsx";
import type { PromptReference } from "@writer/pages/workspace/promptReferences.ts";
import { useDocumentDraft } from "@writer/pages/workspace/useDocumentDraft.ts";
import type { MoveTarget } from "@writer/pages/workspace/workspaceTree.ts";

export type EditorPanelProps = {
  project: string;
  item: DocumentItem;
  // 所在冊／設定集的 public_id（空字串＝未分冊／未歸類）與可選的冊／設定集（第一個是未分冊／未歸類）
  groupId: string;
  groupTargets: MoveTarget[];
  // 工作台樹上的公開狀態（側邊列／列表的 ⋮ 可能改它）
  status?: string;
  profile: Profile | null;
  // 有沒有未存檔內容，外層據此在換文件、離開專案前先問
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onShowHistory: () => void;
  onAskAI: (reference: PromptReference) => void;
};

// 編輯分頁：先載入文件，文字作品（故事、設定）用網站的所見即所得編輯器，圖像作品用 ImageDocumentEditor。
export function EditorPanel(props: EditorPanelProps) {
  const { project, item } = props;
  const doc = useBackendData(() => backend.Document(project, item.kind, item.public_id), [project, item.kind, item.public_id]);
  if (doc === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  if (!doc) return null;
  return doc.content_type === "image" ? <ImageDocumentEditor {...props} doc={doc} /> : <TextDocumentEditor {...props} doc={doc} />;
}

// 文字作品：直接用網站的編輯器（右鍵選單、slash 指令、浮動工具列、表格、腳注…全部一致），
// 外框（標題、屬性列、摘要、底部狀態列與存檔按鈕）也用網站工作台內嵌編輯頁的同一組元件。
function TextDocumentEditor({ project, item, doc, groupId, status, groupTargets, profile, onDirtyChange, onSaved, onShowHistory, onAskAI }: EditorPanelProps & { doc: Document }) {
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => initialAutoSaveMinutes(profile));
  const state = useDocumentDraft({ project, item, doc, groupId, status, autoSaveMinutes, onSaved, onDirtyChange });
  const { draft, setContent, saving, updatedAt, save } = state;
  const wordCount = useMemo(() => contentWordCount(draft.content), [draft.content]);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", px: 2.5, pt: 1.5 }}>
      <DocumentHeader
        project={project}
        item={item}
        variant={item.kind === "lore" ? "lore" : "story"}
        state={state}
        profile={profile}
        groupTargets={groupTargets}
        warningSource={draft.content}
        extraControls={<EditorAutoSaveButton minutes={autoSaveMinutes} onChange={setAutoSaveMinutes} />}
        onShowHistory={onShowHistory}
      />
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
              caretMemoryKey={`${item.kind}:${item.public_id}`}
              hasSavedTarget
              onSelectionAgentTrigger={(trigger) => onAskAI({
                type: "document_selection",
                id: `document:${item.kind}:${item.public_id}:${crypto.randomUUID()}`,
                title: draft.title,
                text: trigger.selectedText,
                document_kind: item.kind,
                document_id: item.public_id,
                base_version_id: doc.latest_version_id == null ? undefined : String(doc.latest_version_id),
              })}
            />
          }
        />
      </Box>
    </Box>
  );
}

import type { DocumentDependencyOption } from "@/pages/storyteller/documentEditor/DocumentEditorHeader.tsx";
import { SteamLoomDocumentEditor } from "@/pages/storyteller/documentEditor/SteamLoomDocumentEditor.tsx";
import { initialAutoSaveMinutes } from "@/pages/storyteller/documentEditor/autoSaveMinutes.ts";
import { useDocumentEditing, type DocumentKind } from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";
import { useWebDocumentAdapter } from "@/pages/storyteller/documentEditor/webDocumentAdapter.ts";
import { CircularProgress } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { backend, type Document, type DocumentItem, type Profile } from "@writer/lib/backend.ts";
import { toEditingDocument, useWriterDocumentLabels, useWriterEditingMessages, useWriterNotify } from "@writer/lib/documentEditing.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { ImageDocumentEditor } from "@writer/pages/workspace/ImageDocumentEditor.tsx";
import type { PromptReference } from "@writer/pages/workspace/promptReferences.ts";
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
  // 設定的「需先讀過」可選的故事與其他設定
  dependencyOptions: DocumentDependencyOption[];
  // 有沒有未存檔內容，外層據此在換文件、離開專案前先問
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onAskAI: (reference: PromptReference) => void;
};

// 先載入文件：文字作品（故事、設定）用網站的共用編輯頁，圖像作品用 ImageDocumentEditor。
export function EditorPanel(props: EditorPanelProps) {
  const { project, item } = props;
  const doc = useBackendData(() => backend.Document(project, item.kind, item.public_id), [project, item.kind, item.public_id]);
  if (doc === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  if (!doc) return null;
  return doc.content_type === "image" ? <ImageDocumentEditor {...props} doc={doc} /> : <TextDocumentEditor {...props} doc={doc} />;
}

// 文字作品：跟網站同一個編輯頁（SteamLoomDocumentEditor：編輯／編輯歷史分頁、頁首、所見即所得編輯器、大綱與書籤、插入資產）。
// 存檔走網站的 API（經 ApiProxy），Writer 只負責：視窗重新取得焦點時重新載入、工作台樹的狀態同步、關閉視窗前確認、問 AI。
function TextDocumentEditor({ project, item, doc: initialDoc, groupId, groupTargets, status, profile, dependencyOptions, onDirtyChange, onSaved, onAskAI }: EditorPanelProps & { doc: Document }) {
  const kind = item.kind as DocumentKind;
  const [doc, setDoc] = useState(initialDoc);
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => initialAutoSaveMinutes(profile));
  const { notify, notifyError } = useWriterNotify();
  const editingDoc = useMemo(() => toEditingDocument(doc, groupId), [doc, groupId]);
  const editing = useDocumentEditing({
    doc: editingDoc,
    adapter: useWebDocumentAdapter(kind, project),
    autoSaveMinutes,
    messages: useWriterEditingMessages(),
    notify,
    notifyError,
    onSaved: () => onSaved(),
  });
  const labels = useWriterDocumentLabels(kind);

  // 側邊列／列表的 ⋮ 切換了這篇的公開狀態：跟著換。只看「變動」不看初值——工作台樹可能比剛載入的文件舊
  const statusPropRef = useRef(status);
  useEffect(() => {
    if (status === statusPropRef.current) return;
    statusPropRef.current = status;
    if (status) setDoc((current) => ({ ...current, status }) as Document);
  }, [status]);

  // 視窗重新取得焦點時，沒有未存檔內容就看伺服器上有沒有新版本（網站或 AI 助理改過）；有的話 useDocumentEditing 會換上
  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  });
  useEffect(() => {
    const onFocus = async () => {
      if (editingRef.current.dirty) return;
      // 取不到就算了，不打擾寫作；下次取得焦點再看
      const latest = await backend.Document(project, item.kind, item.public_id).catch(() => null);
      if (latest) setDoc(latest);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [project, item.kind, item.public_id]);

  // 有未存檔內容時讓外層（換文件／離開專案）與 Go 端（關閉視窗）先問；離開這篇時清掉
  const dirty = editing.dirty;
  useEffect(() => {
    onDirtyChange(dirty);
    void backend.SetUnsaved(dirty);
  }, [dirty]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      void backend.SetUnsaved(false);
    },
    [],
  );

  return (
    <SteamLoomDocumentEditor
      kind={kind}
      projectPublicId={project}
      editing={editing}
      labels={labels}
      notify={notify}
      notifyError={notifyError}
      groups={groupTargets.filter((target) => target.publicId !== "").map((target) => ({ publicId: target.publicId, name: target.name }))}
      penName={profile?.pen_name}
      profiles={profile?.profiles ?? []}
      dependencyOptions={dependencyOptions}
      autoSaveMinutes={autoSaveMinutes}
      onAutoSaveMinutesChange={setAutoSaveMinutes}
      sx={{ flex: 1, px: 2.5 }}
      editorProps={{
        onSelectionAgentTrigger: (trigger) =>
          onAskAI({
            type: "document_selection",
            id: `document:${item.kind}:${item.public_id}:${crypto.randomUUID()}`,
            title: editing.draft.title,
            text: trigger.selectedText,
            document_kind: item.kind,
            document_id: item.public_id,
            base_version_id: doc.latest_version_id == null ? undefined : String(doc.latest_version_id),
          }),
      }}
    />
  );
}

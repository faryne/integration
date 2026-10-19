import type { AlertColor } from "@mui/material";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerAgenticPanel } from "@/pages/storyteller/StorytellerAgenticPanel.tsx";
import {
  applyStorytellerAgentText,
  type StorytellerAgentTextSelection,
} from "@/pages/storyteller/storytellerAgentEditing.ts";
import type { StorytellerSelectionAgentTrigger } from "@/pages/storyteller/storytellerSelectionAgentTrigger.ts";
import type { StorytellerWysiwygEditor } from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import type {
  StorytellerAgenticProposal,
  StorytellerLore,
  StorytellerStory,
} from "@/types/storyteller.ts";
import type {
  DocumentAttributePatch,
  DocumentDraft,
  DocumentEditingState,
  DocumentKind,
  PublicationStatus,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

// public_id 一律是 16 個小寫十六進位字元。AI 提案裡的冊／設定集 id 偶爾是髒值（把參數說明整段當成值），
// 送到後端只會 400、作者也看不出是哪個欄位壞的；不像 id 就當作 AI 沒要動這個欄位，保留目前的
const looksLikePublicId = (value: string) => /^[0-9a-f]{16}$/.test(value);

// 網站站內 AI 助理的工作區接線（StorytellerAgenticPanel 以 decoration 插在正文段落之間）。
// 站內 AI 助理目前停用（STORYTELLER_AI_ASSISTANT_ENABLED），程式碼刻意保留；enabled=false 時不回傳任何編輯器屬性，
// 編輯器的「問 AI」入口（/、右鍵、浮動選單）會一併消失。hook 一律呼叫，不受 early return 影響。
export function useDocumentEditorAgentWorkspace({
  enabled,
  kind,
  editing,
  projectPublicId,
  document,
  agents,
  stories,
  lores,
  penName,
  notify,
}: {
  enabled: boolean;
  kind: DocumentKind;
  editing: DocumentEditingState;
  projectPublicId?: string;
  document?: StorytellerStory | StorytellerLore;
  agents: {
    id: number;
    name: string;
    default_prompt: string;
    is_deleted: boolean;
  }[];
  stories: StorytellerStory[];
  lores: StorytellerLore[];
  penName?: string;
  notify: (message: string, severity?: AlertColor) => void;
}): Partial<ComponentProps<typeof StorytellerWysiwygEditor>> | undefined {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [anchorMarkerId, setAnchorMarkerId] = useState<string | null>(null);
  // 選取觸發要保留到 AI 面板完成 mount，關閉工作區時才清除；在 child effect 立即消費的話，
  // React Strict Mode 重跑 mount 會讓第二次拿不到原文
  const [pendingTrigger, setPendingTrigger] =
    useState<StorytellerSelectionAgentTrigger | null>(null);
  if (!enabled) return undefined;

  const { draft } = editing;
  const publicId = editing.publicId();
  const close = () => {
    setOpen(false);
    setPendingTrigger(null);
  };
  const handleTrigger = (trigger: StorytellerSelectionAgentTrigger) => {
    setOpen(true);
    setAnchorMarkerId(trigger.markerId ?? null);
    setPendingTrigger(trigger);
  };

  // 提案目標剛好是這篇：屬性（冊／設定集、狀態）走 PATCH，標題／摘要／內文填進編輯區後以 agent_apply 存一次，
  // 編輯歷史看得出這版是套用 AI 提案存的。沒帶到的欄位維持畫面上的值；失敗就 reject，卡片不會標成已套用。
  const applyProposal = async (proposal: StorytellerAgenticProposal) => {
    const args = proposal.arguments;
    const groupArg =
      kind === "story" ? args.volume_public_id : args.collection_id;
    const attributes: DocumentAttributePatch = {};
    if (
      typeof groupArg === "string" &&
      groupArg !== draft.groupId &&
      (groupArg === "" || looksLikePublicId(groupArg))
    )
      attributes.groupId = groupArg;
    if (
      kind === "story" &&
      (args.status === "draft" || args.status === "completed") &&
      args.status !== draft.status
    )
      attributes.status = args.status as PublicationStatus;
    if (Object.keys(attributes).length)
      await editing.changeAttributes(attributes);
    const patch: Partial<DocumentDraft> = {};
    if (typeof args.title === "string") patch.title = args.title;
    if (kind === "story" && typeof args.summary === "string")
      patch.summary = args.summary;
    // 段落 markerId 不用處理，後端存檔時統一補齊
    if (typeof args.content === "string") patch.content = args.content;
    if (!publicId) {
      editing.setDraft(patch);
      return;
    }
    const result = await editing.save("agent_apply", patch);
    if (!result) throw new Error(t("web.agent.errors.applyProposalSave"));
  };
  const applyText = (
    result: string,
    action: "replace" | "insert" | "append" | "copy",
    selection: StorytellerAgentTextSelection | null,
  ) =>
    // 插入游標／取代選取需要 textarea 游標位置，目前停用（UI 也隱藏了），實際只會走 append／copy
    applyStorytellerAgentText({
      result,
      action,
      content: draft.content,
      resultSelection: selection,
      target: null,
      setContent: (value) =>
        editing.setDraft({
          content: typeof value === "function" ? value(draft.content) : value,
        }),
      onCopy: () => notify(t("web.agent.messages.responseCopied")),
      onSelectionMismatch: () =>
        notify(t("web.agent.errors.selectionChanged"), "error"),
      onAfterApply: () => {},
    });

  return {
    onSelectionAgentTrigger: handleTrigger,
    inlineAssistantOpen: open,
    inlineAssistantAnchorMarkerId: anchorMarkerId,
    inlineAssistant: (
      <StorytellerAgenticPanel
        targetKind={kind}
        presentation="workspace"
        onClose={close}
        projectPublicId={projectPublicId}
        targetPublicId={publicId}
        agents={agents.map((agent) => ({
          id: String(agent.id),
          name: agent.name,
          prompt: agent.default_prompt,
          enabled: !agent.is_deleted,
        }))}
        currentStory={{
          title: draft.title,
          summary: kind === "story" ? draft.summary : "",
          content: draft.content,
          versionId: document?.latest_version_id ?? null,
          updatedAt: document?.updated_at ?? new Date().toISOString(),
        }}
        otherStories={stories
          .filter((story) => kind !== "story" || story.public_id !== publicId)
          .map((story) => ({
            id: story.public_id,
            title: story.title,
            content: story.latest_content,
          }))}
        lores={lores
          .filter((lore) => kind !== "lore" || lore.public_id !== publicId)
          .map((lore) => ({
            id: lore.public_id,
            title: lore.title,
            content: lore.latest_content,
          }))}
        penName={penName}
        onApplyText={applyText}
        onApplyProposalToEditor={applyProposal}
        hasUnsavedChanges={editing.hasUnsavedChanges}
        onSaveBeforeApply={async () =>
          (await editing.save("manual"))?.versionId ?? null
        }
        pendingSelectionAgentTrigger={pendingTrigger}
      />
    ),
  };
}

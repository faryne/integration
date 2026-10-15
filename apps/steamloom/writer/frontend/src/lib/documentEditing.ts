import type { DocumentEditorLabels } from "@/pages/storyteller/documentEditor/documentEditorLabels.ts";
import type {
  DocumentEditingAdapter,
  DocumentEditingMessages,
  DocumentKind,
  EditingDocument,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";
import { AxiosError } from "axios";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type Document } from "@writer/lib/backend.ts";

// Writer 接上網站共用編輯頁（static_site 的 documentEditor/）用到的東西：多語系文字、通知、Go 文件轉成編輯用的形狀、
// 圖像作品用的 Go adapter（文字文件用網站的 useWebDocumentAdapter，經 ApiProxy 轉發）。

// 圖像作品的標題／摘要跟網站一樣叫「描述」
type Variant = DocumentKind | "image";

export function useWriterDocumentLabels(kind: DocumentKind, variant: Variant = kind): DocumentEditorLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      tabs: { editor: t("workspace.tabs.editor"), history: t("workspace.tabs.history") },
      scope: { only: t("workspace.editor.scope.only"), backToFull: t("workspace.editor.scope.backToFull") },
      titlePlaceholder: t(`workspace.editor.titlePlaceholder.${variant}`),
      summaryPlaceholder: t(`workspace.editor.summaryPlaceholder.${variant}`),
      status: t("workspace.editor.status"),
      group: t(`workspace.editor.group.${kind}`),
      authors: t("workspace.editor.authors"),
      self: (penName) => (penName ? t("workspace.editor.self", { penName }) : t("workspace.editor.selfOnly")),
      ungrouped: t(kind === "story" ? "workspace.ungroupedStories" : "workspace.uncategorizedLores"),
      spoiler: t("workspace.editor.spoiler.label"),
      spoilerNo: t("workspace.editor.spoiler.no"),
      spoilerYes: t("workspace.editor.spoiler.yes"),
      dependsOn: t("workspace.editor.dependsOn"),
      dependencyStory: t("workspace.editor.dependency.story"),
      dependencyLore: t("workspace.editor.dependency.lore"),
      autoSave: {
        label: t("workspace.editor.autoSave.label"),
        off: t("workspace.editor.autoSave.off"),
        every: (minutes) => t("workspace.editor.autoSave.every", { minutes }),
        custom: t("workspace.editor.autoSave.custom"),
        range: (min, max) => t("workspace.editor.autoSave.range", { min, max }),
      },
      conflict: t(`workspace.editor.conflict.${kind}`),
      viewHistory: t("workspace.editor.conflict.viewHistory"),
      saveFailedBanner: t("workspace.editor.saveFailedBanner"),
      insertAsset: t("workspace.editor.insertAsset"),
      insertAssetTitle: t(`workspace.editor.insertAssetTitle.${kind}`),
      assetInserted: t("workspace.editor.assetInserted"),
      assetInsertFailed: t("workspace.editor.assetInsertFailed"),
      backToList: "",
      historyEmpty: t(`workspace.editor.historyEmpty.${kind}`),
      reverted: t("workspace.editor.reverted"),
      revertFailed: t("workspace.editor.revertFailed"),
    }),
    [kind, t, variant],
  );
}

export function useWriterEditingMessages(): DocumentEditingMessages {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      saved: t("workspace.editor.saved"),
      autoSaved: t("workspace.editor.autoSaved"),
      agentApplied: t("workspace.editor.agentApplied"),
      saveFailed: t("workspace.editor.saveFailed"),
      autoSaveFailed: t("workspace.editor.autoSaveFailed"),
      titleRequired: t("workspace.editor.titleRequired"),
      attributeFailed: t("workspace.editor.attributeFailed"),
    }),
    [t],
  );
}

// 網站 API 經 ApiProxy 回的錯誤是 AxiosError：優先取後端回的 message；Go 綁定的錯誤是字串
const describeError = (error: unknown) => {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message || error.message;
  }
  return errorMessage(error);
};

// 授權失效時 ApiProxy（webApi.tsx）已經讓外層回登入頁，這裡不再跳錯誤訊息
export function useWriterNotify() {
  const { showError, showSuccess, showWarning } = useSnack();
  const notify = useCallback(
    (message: string, severity: "success" | "info" | "warning" | "error" = "success") =>
      (severity === "error" ? showError : severity === "warning" ? showWarning : showSuccess)(message),
    [showError, showSuccess, showWarning],
  );
  const notifyError = useCallback(
    (fallback: string, error: unknown) => {
      const detail = describeError(error);
      if (isNotLoggedIn(detail)) return;
      showError(`${fallback}${detail}`);
    },
    [showError],
  );
  return { notify, notifyError };
}

// Go 回的文件轉成共用編輯頁的形狀；groupId 由工作台樹提供（後端回的故事 parent_id 是內部 id）
export const toEditingDocument = (doc: Document, groupId: string): EditingDocument => ({
  publicId: doc.public_id,
  title: doc.title,
  summary: doc.summary ?? "",
  content: doc.latest_content ?? "",
  status: doc.status === "completed" ? "completed" : "draft",
  groupId,
  profileIds: doc.profile_ids?.length ? doc.profile_ids : [0],
  isSpoiler: Boolean(doc.is_spoiler),
  dependsOn: (doc.depends_on ?? []).map((each) => `${each.target_type}:${each.target_public_id}`),
  versionId: doc.latest_version_id ?? null,
  updatedAt: doc.updated_at,
  sort: doc.sort ?? 0,
});

// 圖像作品存檔走 Go 綁定：存檔前要先把本機圖上傳成資產（prepare），這段只有 Go 端做得到
export const goDocumentAdapter = (
  project: string,
  kind: DocumentKind,
  prepare?: DocumentEditingAdapter["prepare"],
): DocumentEditingAdapter => ({
  prepare,
  save: async (draft, { trigger, publicId, baseVersionId }) => {
    const result = await backend.SaveDocument(project, kind, publicId!, {
      title: draft.title,
      summary: draft.summary,
      content: draft.content,
      trigger,
      base_version_id: baseVersionId ?? undefined,
    });
    return { versionId: result.latest_version_id ?? null, updatedAt: result.updated_at, conflict: result.version_conflict };
  },
  patch: (publicId, patch) =>
    backend.PatchDocument(project, kind, publicId, { status: patch.status, group_id: patch.groupId, profile_ids: patch.profileIds }),
});

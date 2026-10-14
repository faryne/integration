import { Box } from "@mui/material";
import { useMemo, useState } from "react";
import {
  useRevertStorytellerLoreVersion,
  useRevertStorytellerStoryVersion,
  useStorytellerLoreVersions,
  useStorytellerStoryVersions,
} from "@/apis/storyteller.ts";
import { storytellerVersionSourceLabel } from "@/data/storytellerVersionSource.ts";
import {
  StoryEditHistory,
  type StoryEditHistoryItem,
} from "@/pages/storyteller/StoryEditHistory.tsx";
import {
  StorytellerVersionCompareDialog,
  type StorytellerVersionCompareEntry,
} from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import { useVersionCompareSelection } from "@/pages/storyteller/useVersionCompareSelection.ts";
import type { StorytellerLore, StorytellerStory } from "@/types/storyteller.ts";
import type { DocumentEditorLabels } from "@/pages/storyteller/documentEditor/documentEditorLabels.ts";
import type {
  DocumentKind,
  DocumentNotify,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

const PAGE_SIZE = 10;

// 「編輯歷史」分頁（網站與 SteamLoom Writer 共用）：版本表格、選兩版比對、回復到某個版本。
// 資料用網站的 API hook，Writer 經 ApiProxy 轉發。版本列表本身就帶完整內文，比對時不用另外抓。
export function DocumentHistoryPanel({
  kind,
  projectPublicId,
  publicId,
  itemTitle,
  labels,
  active,
  notify,
  notifyError,
  onReverted,
}: {
  kind: DocumentKind;
  projectPublicId?: string;
  // 沒有＝還沒存過的新文件
  publicId?: string;
  itemTitle: string;
  labels: DocumentEditorLabels;
  // 分頁打開時才抓版本列表
  active: boolean;
  notify: DocumentNotify;
  notifyError: (fallback: string, error: unknown) => void;
  // 回復成功，帶回後端回傳的文件（編輯分頁要換上這份內容）
  onReverted: (document: StorytellerStory | StorytellerLore) => void;
}) {
  const storyVersions = useStorytellerStoryVersions(
    projectPublicId,
    kind === "story" ? publicId : undefined,
    active,
  );
  const loreVersions = useStorytellerLoreVersions(
    projectPublicId,
    kind === "lore" ? publicId : undefined,
    active,
  );
  const revertStory = useRevertStorytellerStoryVersion(
    projectPublicId,
    publicId,
  );
  const revertLore = useRevertStorytellerLoreVersion(projectPublicId, publicId);
  const versionsQuery = kind === "story" ? storyVersions : loreVersions;
  const revert = kind === "story" ? revertStory : revertLore;
  const versions = useMemo(
    () =>
      // 新的在上；StoryEditHistory 依這個順序編版本號
      [...(versionsQuery.data ?? [])].sort((a, b) => b.id - a.id),
    [versionsQuery.data],
  );
  const items = useMemo<StoryEditHistoryItem[]>(
    () =>
      versions.map((version) => ({
        id: String(version.id),
        title: version.title,
        source: storytellerVersionSourceLabel(version.source),
        createdAt: version.created_at,
        words: version.word_count,
        revertedFromVersionId: version.reverted_from_version_id
          ? String(version.reverted_from_version_id)
          : null,
        conflictedWithVersionId: version.conflicted_with_version_id
          ? String(version.conflicted_with_version_id)
          : null,
      })),
    [versions],
  );
  const selection = useVersionCompareSelection(items);
  const [page, setPage] = useState(1);
  const [comparing, setComparing] = useState(false);

  const entryOf = (
    versionId: string,
  ): StorytellerVersionCompareEntry | null => {
    const version = versions.find((each) => String(each.id) === versionId);
    if (!version) return null;
    return {
      title: version.title,
      // 設定的版本沒有摘要，留 undefined 比對視窗就不會出現摘要區塊
      summary: "summary" in version ? version.summary : undefined,
      content: version.content,
      source: storytellerVersionSourceLabel(version.source),
      createdAt: version.created_at,
    };
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", py: 2 }}>
      <Box sx={{ maxWidth: 960, mx: "auto" }}>
        <StoryEditHistory
          items={items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          allItems={items}
          loading={versionsQuery.isLoading}
          leftVersionId={selection.leftVersionId}
          rightVersionId={selection.rightVersionId}
          onCompare={() => setComparing(true)}
          onLeftVersionChange={selection.handleLeftVersionChange}
          onRightVersionChange={selection.setRightVersionId}
          isRightVersionDisabled={selection.isRightVersionDisabled}
          isNewItem={!publicId}
          newItemMessage={labels.historyEmpty}
          page={page}
          pageCount={Math.max(1, Math.ceil(items.length / PAGE_SIZE))}
          onPageChange={setPage}
          currentVersionId={versions[0] ? String(versions[0].id) : undefined}
          revertingVersionId={
            revert.isPending ? String(revert.variables) : null
          }
          onRevert={(versionId) =>
            revert.mutate(Number(versionId), {
              onSuccess: (document) => {
                notify(labels.reverted);
                if (document) onReverted(document);
              },
              onError: (error) => notifyError(labels.revertFailed, error),
            })
          }
        />
      </Box>
      <StorytellerVersionCompareDialog
        open={comparing}
        onClose={() => setComparing(false)}
        itemTitle={itemTitle}
        leftVersion={entryOf(selection.leftVersionId)}
        rightVersion={entryOf(selection.rightVersionId)}
      />
    </Box>
  );
}

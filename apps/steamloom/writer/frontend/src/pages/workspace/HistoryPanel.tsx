import { storytellerVersionSourceLabel } from "@steamloom-web/data/storytellerVersionSource.ts";
import { StoryEditHistory, type StoryEditHistoryItem } from "@steamloom-web/pages/storyteller/StoryEditHistory.tsx";
import {
  StorytellerVersionCompareDialog,
  type StorytellerVersionCompareEntry,
} from "@steamloom-web/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import { useVersionCompareSelection } from "@steamloom-web/pages/storyteller/useVersionCompareSelection.ts";
import { Box, CircularProgress } from "@mui/material";
import { useMemo, useState } from "react";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type DocumentItem, type VersionDetail } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";

// Writer 是整個分頁的空間，一頁比網站側欄（5 筆）多放一些
const PAGE_SIZE = 10;

// 編輯歷史分頁：表格、選版本規則、比對視窗都直接用網站的元件，兩邊行為一致。
// 比對視窗只顯示差異前後幾行（collapseUnchangedLines），網站同步生效。
export function HistoryPanel({ project, item }: { project: string; item: DocumentItem }) {
  const { showError } = useSnack();
  const versions = useBackendData(() => backend.Versions(project, item.kind, item.public_id), [project, item.kind, item.public_id]);
  // 新的在上，跟網站一樣；StoryEditHistory 依這個順序編版本號
  const items = useMemo<StoryEditHistoryItem[]>(
    () =>
      [...(versions ?? [])]
        .sort((a, b) => b.id - a.id)
        .map((version) => ({
          id: String(version.id),
          title: version.title,
          source: storytellerVersionSourceLabel(version.source),
          createdAt: version.created_at,
          words: version.word_count,
          revertedFromVersionId: version.reverted_from_version_id ? String(version.reverted_from_version_id) : null,
          conflictedWithVersionId: version.conflicted_with_version_id ? String(version.conflicted_with_version_id) : null,
        })),
    [versions],
  );
  const selection = useVersionCompareSelection(items);
  const [page, setPage] = useState(1);
  const [comparing, setComparing] = useState(false);
  const [compare, setCompare] = useState<{ left: StorytellerVersionCompareEntry; right: StorytellerVersionCompareEntry } | null>(null);

  if (versions === null) return <CircularProgress size={24} sx={{ m: 4 }} />;

  // 比對時才抓兩個版本的完整內文（列表本身不帶內文）
  const toEntry = (version: VersionDetail): StorytellerVersionCompareEntry => ({
    title: version.title,
    // 設定沒有摘要，留 undefined 比對視窗就不會出現摘要區塊
    summary: item.kind === "story" ? version.summary : undefined,
    content: version.content,
    source: storytellerVersionSourceLabel(version.source),
    createdAt: version.created_at,
  });
  const openCompare = async () => {
    setComparing(true);
    try {
      const [left, right] = await Promise.all(
        [selection.leftVersionId, selection.rightVersionId].map((id) => backend.VersionDetail(project, item.kind, item.public_id, id)),
      );
      setCompare({ left: toEntry(left), right: toEntry(right) });
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setComparing(false);
    }
  };

  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
      <Box sx={{ maxWidth: 960 }}>
        <StoryEditHistory
          items={items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          allItems={items}
          loading={comparing}
          leftVersionId={selection.leftVersionId}
          rightVersionId={selection.rightVersionId}
          onCompare={openCompare}
          onLeftVersionChange={selection.handleLeftVersionChange}
          onRightVersionChange={selection.setRightVersionId}
          isRightVersionDisabled={selection.isRightVersionDisabled}
          page={page}
          pageCount={Math.max(1, Math.ceil(items.length / PAGE_SIZE))}
          onPageChange={setPage}
        />
      </Box>
      <StorytellerVersionCompareDialog
        open={compare !== null}
        onClose={() => setCompare(null)}
        itemTitle={item.title}
        leftVersion={compare?.left ?? null}
        rightVersion={compare?.right ?? null}
      />
    </Box>
  );
}

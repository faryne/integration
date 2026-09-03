import { Paper } from "@mui/material";

import {
  StoryEditHistory,
  type StoryEditHistoryItem,
} from "@/pages/storyteller/StoryEditHistory.tsx";

interface StoryEditorHistoryPanelProps {
  items: StoryEditHistoryItem[];
  allItems: StoryEditHistoryItem[];
  loading: boolean;
  leftVersionId: string;
  rightVersionId: string;
  page?: number;
  pageCount?: number;
  currentVersionId?: string;
  revertingVersionId: string | null;
  isNewStory: boolean;
  newItemMessage?: string;
  onCompare: () => void;
  onLeftVersionChange: (versionId: string) => void;
  onRightVersionChange: (versionId: string) => void;
  onPageChange?: (page: number) => void;
  onRevert: (versionId: string) => void;
  isRightVersionDisabled: (versionId: string) => boolean;
}

// 編輯歷史是右側 dock 的其中一個上下文面板；資料怎麼來交給 StoryEditor，
// 這裡只管版本清單在寫作畫面旁邊怎麼呈現。
export function StoryEditorHistoryPanel({
  items,
  allItems,
  loading,
  leftVersionId,
  rightVersionId,
  page,
  pageCount,
  currentVersionId,
  revertingVersionId,
  isNewStory,
  newItemMessage = "新故事第一次存檔後才會產生編輯歷史。",
  onCompare,
  onLeftVersionChange,
  onRightVersionChange,
  onPageChange,
  onRevert,
  isRightVersionDisabled,
}: StoryEditorHistoryPanelProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2, overflow: "auto" }}>
      <StoryEditHistory
        items={items}
        allItems={allItems}
        loading={loading}
        leftVersionId={leftVersionId}
        rightVersionId={rightVersionId}
        onCompare={onCompare}
        onLeftVersionChange={onLeftVersionChange}
        onRightVersionChange={onRightVersionChange}
        isRightVersionDisabled={isRightVersionDisabled}
        isNewItem={isNewStory}
        newItemMessage={newItemMessage}
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        currentVersionId={currentVersionId}
        revertingVersionId={revertingVersionId}
        onRevert={onRevert}
      />
    </Paper>
  );
}

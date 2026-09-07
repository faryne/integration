import { Box } from "@mui/material";
import type { ReactNode } from "react";

interface StoryWritingWorkspaceProps {
  editor: ReactNode;
  fillHeight?: boolean;
}

// 故事／設定集編輯頁的寫作骨架只負責稿紙置中；AI 助理與編輯歷史已改由
// 各自的 Drawer 覆蓋呈現，不再在這裡依斷點切換 dock 版面。
export function StoryWritingWorkspace({
  editor,
  fillHeight = false,
}: StoryWritingWorkspaceProps) {
  return (
    <Box
      sx={{
        position: "relative",
        height: fillHeight ? 1 : undefined,
        minHeight: fillHeight ? 0 : undefined,
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          width: "100%",
          maxWidth: 920,
          mx: "auto",
          height: fillHeight ? 1 : undefined,
          minHeight: fillHeight ? 0 : undefined,
        }}
      >
        {editor}
      </Box>
    </Box>
  );
}

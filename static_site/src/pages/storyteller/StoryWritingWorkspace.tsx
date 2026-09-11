import { Box } from "@mui/material";
import type { ReactNode } from "react";

interface StoryWritingWorkspaceProps {
  editor: ReactNode;
  assistant?: ReactNode;
  assistantOpen?: boolean;
  fillHeight?: boolean;
}

// 故事／設定集編輯頁的寫作骨架：編輯器與 AI 共用同一個主畫布，AI 開啟時只展開
// 唯一一個下方工作區，不再佔用右側 Drawer，也不會為每段內容累積一張 thread 卡。
export function StoryWritingWorkspace({
  editor,
  assistant,
  assistantOpen = false,
  fillHeight = false,
}: StoryWritingWorkspaceProps) {
  return (
    <Box
      sx={{
        position: "relative",
        height: fillHeight ? 1 : undefined,
        minHeight: fillHeight ? 0 : undefined,
        display: "flex",
        flexDirection: "column",
        gap: assistantOpen ? 1 : 0,
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
          flex: fillHeight ? 1 : undefined,
          overflow: fillHeight ? "hidden" : undefined,
        }}
      >
        {editor}
      </Box>
      {assistant && (
        <Box
          sx={{
            display: assistantOpen ? "block" : "none",
            width: "100%",
            maxWidth: 920,
            mx: "auto",
            height: fillHeight ? "48%" : { xs: 520, md: 620 },
            minHeight: fillHeight ? 280 : 360,
            flexShrink: 0,
          }}
        >
          {assistant}
        </Box>
      )}
    </Box>
  );
}

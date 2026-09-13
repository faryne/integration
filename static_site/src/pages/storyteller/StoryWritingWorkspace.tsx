import { Box } from "@mui/material";
import type { ReactNode } from "react";

interface StoryWritingWorkspaceProps {
  editor: ReactNode;
  fillHeight?: boolean;
}

// 故事／設定集編輯頁的寫作骨架只負責稿紙置中；AI 工作區由 WYSIWYG editor
// 透過 ProseMirror decoration 插在正文段落之間，不在這一層另外切割版面。
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

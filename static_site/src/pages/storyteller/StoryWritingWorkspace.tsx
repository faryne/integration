import { Box, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

interface StoryWritingWorkspaceProps {
  editor: ReactNode;
  dock?: ReactNode;
}

interface StoryWritingDockProps {
  children: ReactNode;
}

// 故事編輯頁的寫作骨架：中間保留稿紙感，右欄只當上下文 dock，
// 不在這裡理解 history / agent / 設定集的資料邏輯。
export function StoryWritingWorkspace({
  editor,
  dock,
}: StoryWritingWorkspaceProps) {
  const dockOpen = Boolean(dock);

  return (
    <Box
      sx={{
        position: "relative",
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          width: "100%",
          maxWidth: 920,
          mx: "auto",
        }}
      >
        {editor}
      </Box>

      {dockOpen && <StoryWritingDock>{dock}</StoryWritingDock>}
    </Box>
  );
}

function StoryWritingDock({ children }: StoryWritingDockProps) {
  return (
    <Stack
      spacing={2}
      sx={{
        minWidth: 0,
        mt: { xs: 2, xl: 0 },
        borderLeft: { xl: 1 },
        borderColor: { xl: "divider" },
        pl: { xl: 2.5 },
        width: { xl: 380 },
        height: { xl: "auto" },
        overflow: { xl: "auto" },
        position: { xs: "static", xl: "fixed" },
        top: { xl: 188 },
        right: { xl: 24 },
        bottom: { xl: 64 },
        pr: { xl: 0.5 },
        zIndex: (theme) => theme.zIndex.drawer + 2,
        scrollbarWidth: "thin",
        "&::-webkit-scrollbar": { width: 8 },
        "&::-webkit-scrollbar-thumb": {
          borderRadius: 999,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.18),
        },
      }}
    >
      {children}
    </Stack>
  );
}

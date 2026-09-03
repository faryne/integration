import { Box, Stack } from "@mui/material";
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
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          lg: dockOpen
            ? "minmax(0, 1fr) clamp(340px, 31vw, 460px)"
            : "minmax(0, 1fr)",
        },
        alignItems: "start",
        gap: { xs: 2, lg: 2.5 },
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          width: "100%",
          maxWidth: dockOpen ? "none" : 1040,
          mx: dockOpen ? 0 : "auto",
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
        height: { lg: "calc(100vh - 260px)" },
        minHeight: { lg: 520 },
        overflow: { lg: "auto" },
        position: { lg: "sticky" },
        top: { lg: 104 },
        pr: { lg: 0.5 },
      }}
    >
      {children}
    </Stack>
  );
}

import { Box, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

interface StoryWritingWorkspaceProps {
  editor: ReactNode;
  dock?: ReactNode;
  statusBar?: ReactNode;
}

interface StoryWritingDockProps {
  children: ReactNode;
}

// 故事編輯頁的寫作骨架：中間保留稿紙感，右欄只當上下文 dock，
// 不在這裡理解 history / agent / 設定集的資料邏輯。
export function StoryWritingWorkspace({
  editor,
  dock,
  statusBar,
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
        {statusBar && (
          <StoryWritingStatusBar>{statusBar}</StoryWritingStatusBar>
        )}
      </Box>

      {dockOpen && <StoryWritingDock>{dock}</StoryWritingDock>}
    </Box>
  );
}

function StoryWritingStatusBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: 3,
        mt: 1,
        mx: { xs: -1.5, md: -1 },
        px: { xs: 1.5, md: 1 },
        py: 0.75,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: (theme) =>
          alpha(
            theme.palette.mode === "dark"
              ? theme.palette.background.default
              : theme.palette.background.paper,
            0.94,
          ),
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </Box>
  );
}

function StoryWritingDock({ children }: StoryWritingDockProps) {
  return (
    <Stack
      spacing={2}
      sx={{
        minWidth: 0,
        borderLeft: { lg: 1 },
        borderColor: { lg: "divider" },
        pl: { lg: 2.5 },
        width: { lg: 380 },
        height: { lg: "auto" },
        overflow: { lg: "auto" },
        position: { xs: "static", lg: "fixed" },
        top: { lg: 188 },
        right: { lg: 24 },
        bottom: { lg: 64 },
        pr: { lg: 0.5 },
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

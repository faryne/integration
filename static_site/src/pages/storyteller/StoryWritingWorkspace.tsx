import { Box, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

interface StoryWritingWorkspaceProps {
  editor: ReactNode;
  dock?: ReactNode;
  /** 左側大綱／書籤 dock，跟右側 AI／歷史各自獨立收合，不互斥。 */
  leftDock?: ReactNode;
  fillHeight?: boolean;
}

interface StoryWritingDockProps {
  children: ReactNode;
  side: "left" | "right";
}

// 故事編輯頁的寫作骨架：中間保留稿紙感，左右欄只當上下文 dock，
// 不在這裡理解 history / agent / 大綱 / 設定集的資料邏輯。
export function StoryWritingWorkspace({
  editor,
  dock,
  leftDock,
  fillHeight = false,
}: StoryWritingWorkspaceProps) {
  const leftDockOpen = Boolean(leftDock);
  const rightDockOpen = Boolean(dock);

  return (
    <Box
      sx={{
        position: "relative",
        display: { xl: "flex" },
        alignItems: { xl: "flex-start" },
        gap: { xl: 2.5 },
        height: fillHeight ? 1 : undefined,
        minHeight: fillHeight ? 0 : undefined,
      }}
    >
      {leftDockOpen && (
        <StoryWritingDock side="left">{leftDock}</StoryWritingDock>
      )}

      <Box
        sx={{
          minWidth: 0,
          width: "100%",
          maxWidth: 920,
          mx: "auto",
          height: fillHeight ? 1 : undefined,
          minHeight: fillHeight ? 0 : undefined,
          // xl 版面改用 flex 排列，這個 Box 要能吃掉左右 dock 讓出來以外的所有
          // 剩餘空間，maxWidth 才會是真的上限而不是被 flex-basis: auto 撐開。
          flex: { xl: "1 1 0" },
        }}
      >
        {editor}
      </Box>

      {rightDockOpen && (
        <StoryWritingDock side="right">{dock}</StoryWritingDock>
      )}
    </Box>
  );
}

function StoryWritingDock({ children, side }: StoryWritingDockProps) {
  const isLeft = side === "left";
  return (
    <Stack
      spacing={2}
      sx={{
        minWidth: 0,
        flexShrink: { xl: 0 },
        mt: { xs: isLeft ? 0 : 2, xl: 0 },
        mb: { xs: isLeft ? 2 : 0, xl: 0 },
        borderRadius: { xl: 1 },
        width: { xl: 380 },
        height: { xl: "auto" },
        overflow: { xl: "auto" },
        // 原本 xl 版面用 position:fixed + 寫死的 left:24／right:24（相對整個
        // viewport），完全沒考慮到工作台本來就有一條固定寬度的左側專案導覽
        // （ProjectWorkspacePreview.tsx 的 260px 側欄）——書籤大綱面板會直接
        // 浮在那條導覽上面，兩層背景色疊在一起在深色主題下幾乎分不清楚。改用
        // sticky：這個 Box 現在是 flex row 的其中一個 item，正常排版時本來就會
        // 排在「導覽側欄之後、編輯區之前／之後」，sticky 只負責讓它在直向捲動
        // 時跟著留在畫面上，不會像 fixed 那樣脫離版面座標系統、蓋到別的區塊。
        position: { xs: "static", xl: "sticky" },
        top: { xl: 96 },
        alignSelf: { xl: "flex-start" },
        maxHeight: { xl: "calc(100vh - 160px)" },
        zIndex: (theme) => theme.zIndex.drawer + 1,
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

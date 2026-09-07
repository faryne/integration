import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ReactNode } from "react";

const mobileBottomToolbarOffset = 56;
const mobileDrawerMaxHeight = "45vh";

interface StorytellerEditorSideDrawerProps {
  open: boolean;
  title: string;
  width: number;
  keepMounted?: boolean;
  children: ReactNode;
  onClose: () => void;
}

// 編輯頁右側上下文抽屜共用外框：標題列、可捲動內容區與右側寬度規則集中在這裡，
// 避免 StoryEditor／LoreEditor 這兩個雙胞胎元件的 Drawer 結構漂掉。
export function StorytellerEditorSideDrawer({
  open,
  title,
  width,
  keepMounted = false,
  children,
  onClose,
}: StorytellerEditorSideDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const anchor = isMobile ? "bottom" : "right";

  return (
    <Drawer
      anchor={anchor}
      open={open}
      keepMounted={keepMounted}
      hideBackdrop={isMobile}
      onClose={onClose}
      slotProps={{
        root: {
          sx: isMobile ? { pointerEvents: "none" } : undefined,
        },
        paper: {
          sx: isMobile
            ? {
                // 行動版貼在底部工具列上方，避免參照面板整頁蓋掉正在編輯的內容。
                right: 0,
                bottom: mobileBottomToolbarOffset,
                left: 0,
                width: "100vw",
                maxWidth: "100vw",
                maxHeight: mobileDrawerMaxHeight,
                pointerEvents: "auto",
              }
            : undefined,
        },
      }}
    >
      <Box
        sx={{
          width: isMobile ? "100vw" : width,
          maxWidth: "100vw",
          maxHeight: isMobile ? mobileDrawerMaxHeight : undefined,
          height: isMobile ? mobileDrawerMaxHeight : "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Typography variant="h6" fontWeight={800}>
            {title}
          </Typography>
          <IconButton aria-label={`關閉${title}抽屜`} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 2 }}>
          {children}
        </Box>
      </Box>
    </Drawer>
  );
}

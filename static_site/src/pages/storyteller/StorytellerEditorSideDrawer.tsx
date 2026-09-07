import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

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
  return (
    <Drawer
      anchor="right"
      open={open}
      keepMounted={keepMounted}
      onClose={onClose}
    >
      <Box
        sx={{
          width: { xs: "100vw", sm: width },
          maxWidth: "100vw",
          height: "100%",
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

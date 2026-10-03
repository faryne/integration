import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Drawer,
  IconButton,
  Popover,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ReactNode } from "react";

/**
 * 手機（< sm）開 bottom sheet、桌機開 Popover 的共用彈出層。
 * 閱讀工具列（作品資訊／編輯歷史／閱讀設定）與編輯器「文字設定」共用，避免每處各刻一份 Drawer＋Popover。
 */
export function StorytellerResponsivePopover({
  anchorEl,
  onClose,
  title,
  showTitleOnDesktop = false,
  width,
  placement = "above",
  horizontal = "right",
  mobileMaxHeight,
  children,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  title: string;
  /** 桌機 Popover 預設不顯示標題（觸發按鈕已經說明用途），需要時才打開。 */
  showTitleOnDesktop?: boolean;
  width: number;
  /** 觸發按鈕在畫面下方（閱讀工具列、底部編輯工具列）時往上開，在上方時往下開。 */
  placement?: "above" | "below";
  horizontal?: "left" | "center" | "right";
  mobileMaxHeight?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const open = Boolean(anchorEl);

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            sx: { maxHeight: mobileMaxHeight, borderRadius: "16px 16px 0 0" },
          },
        }}
      >
        <Box sx={{ p: 2, pb: 3 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle1" fontWeight={800}>
              {title}
            </Typography>
            <IconButton aria-label={`關閉${title}`} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
          {children}
        </Box>
      </Drawer>
    );
  }

  const above = placement === "above";
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: above ? "top" : "bottom", horizontal }}
      transformOrigin={{ vertical: above ? "bottom" : "top", horizontal }}
      slotProps={{
        paper: { sx: { width, maxWidth: "calc(100vw - 24px)", p: 2 } },
      }}
    >
      {showTitleOnDesktop && (
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
          {title}
        </Typography>
      )}
      {children}
    </Popover>
  );
}

import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Link, Stack, Typography } from "@mui/material";

/** 首頁各區塊的外框：標題（可帶補充說明、標題旁的小按鈕）＋右側「看全部」連結 */
export function HomeSection({
  title,
  note,
  moreTo,
  moreLabel = "看全部",
  dense,
  action,
  children,
}: {
  title: string;
  note?: string;
  moreTo?: string;
  moreLabel?: string;
  /** 一屏版首頁用：標題小一號、跟內容距離縮短 */
  dense?: boolean;
  /** 標題旁的小按鈕（例如 RSS 訂閱） */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ textAlign: "left" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: dense ? { xs: 0.5, md: 0.75 } : 1.5,
          gap: 1,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
          <Typography
            component="h2"
            sx={{ fontSize: dense ? 16 : 18, fontWeight: 800 }}
          >
            {title}
            {note && (
              <Box
                component="span"
                sx={{
                  color: "text.secondary",
                  fontSize: 13,
                  fontWeight: 400,
                  ml: 1,
                }}
              >
                {note}
              </Box>
            )}
          </Typography>
          {action}
        </Stack>
        {moreTo && (
          <Link
            component={RouterLink}
            to={moreTo}
            underline="hover"
            sx={{ fontSize: 13, whiteSpace: "nowrap" }}
          >
            {moreLabel} →
          </Link>
        )}
      </Stack>
      {children}
    </Box>
  );
}

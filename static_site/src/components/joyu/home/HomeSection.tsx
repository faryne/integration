import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Link, Stack, Typography } from "@mui/material";

/** 首頁各區塊的外框：標題（可帶補充說明）＋右側「看全部」連結 */
export function HomeSection({
  title,
  note,
  moreTo,
  moreLabel = "看全部",
  children,
}: {
  title: string;
  note?: string;
  moreTo?: string;
  moreLabel?: string;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ textAlign: "left" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 1.5,
          gap: 1,
        }}
      >
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 800 }}>
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

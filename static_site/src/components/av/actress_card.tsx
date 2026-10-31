import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";

/**
 * 女優卡片：照片＋名字，名字下方的內容由各頁決定（搜尋頁放假名與身形、主題頁放出演數）。
 * 女優搜尋頁與主題頁共用；rank 有值時在照片左上角顯示名次
 */
export function ActressCard({
  name,
  photo,
  to,
  rank,
  children,
}: {
  name: string;
  photo?: string;
  to: string;
  rank?: number;
  children?: ReactNode;
}) {
  return (
    <Box
      component={RouterLink}
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        textAlign: "left",
        textDecoration: "none",
        transition:
          "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
        "&:focus-visible": {
          borderColor: "primary.main",
          boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.28)",
          outline: 0,
        },
        "&:hover": {
          borderColor: "rgba(25, 118, 210, 0.42)",
          boxShadow: "0 14px 34px rgba(15, 23, 42, 0.13)",
          transform: "translateY(-2px)",
        },
      }}
      to={to}
    >
      {rank !== undefined && (
        <Box
          sx={{
            bgcolor: "rgba(17, 24, 39, 0.75)",
            borderRadius: 1,
            color: "#fff",
            fontSize: "0.75rem",
            fontWeight: 800,
            left: 8,
            position: "absolute",
            px: 0.75,
            top: 8,
            zIndex: 1,
          }}
        >
          {rank}
        </Box>
      )}
      <Box
        sx={{
          aspectRatio: "3 / 4",
          bgcolor: "grey.100",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <ActressPhoto
          alt={name}
          loading="lazy"
          src={photo}
          sx={{ height: "100%", width: "100%" }}
        />
      </Box>
      <Stack spacing={0.75} sx={{ p: 1.5 }}>
        <Typography
          sx={{
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          variant="body1"
        >
          {name}
        </Typography>
        {children}
      </Stack>
    </Box>
  );
}

import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";

// 工作台列表沒有內容時的空狀態（虛線框＋圖示＋標題＋說明），網站工作台與 SteamLoom Writer 共用。
// Writer 透過 alias 直接 import（改這支也會影響 Writer）。
export function WorkspaceEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      sx={{
        minHeight: 180,
        mt: 1,
        px: 3,
        py: 4,
        border: 1,
        borderStyle: "dashed",
        borderColor: "divider",
        borderRadius: 1,
        color: "text.secondary",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025),
      }}
    >
      <Box sx={{ color: "primary.main", opacity: 0.64, lineHeight: 0 }}>
        {icon}
      </Box>
      <Typography fontWeight={800} color="text.primary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}

import { Box, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface CustomEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function CustomEmptyState({
  icon,
  title,
  description,
}: CustomEmptyStateProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        <Box sx={{ color: "text.secondary", lineHeight: 0 }}>{icon}</Box>
        <Stack spacing={0.5}>
          <Typography fontWeight={800}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

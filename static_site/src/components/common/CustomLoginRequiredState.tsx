import LoginIcon from "@mui/icons-material/Login";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface CustomLoginRequiredStateProps {
  description: string;
  onLogin: () => void;
  submitting?: boolean;
  buttonLabel?: string;
  icon?: ReactNode;
  title?: string;
}

export function CustomLoginRequiredState({
  buttonLabel = "使用 Google 登入",
  description,
  icon = <LoginIcon fontSize="large" />,
  onLogin,
  submitting = false,
  title = "需要登入",
}: CustomLoginRequiredStateProps) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
      <Stack spacing={1.5} alignItems="center" textAlign="center">
        {/* 集中管理登入提示區塊，讓需要登入的頁面維持一致視覺。 */}
        <Box sx={{ color: "text.secondary", lineHeight: 0 }}>{icon}</Box>
        <Stack spacing={0.5}>
          <Typography fontWeight={800}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          onClick={onLogin}
          disabled={submitting}
          sx={{ mt: 0.5 }}
        >
          {submitting ? "登入中..." : buttonLabel}
        </Button>
      </Stack>
    </Paper>
  );
}

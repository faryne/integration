import type { ReactNode } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

import { useAuth } from "@/components/auth/AuthContext.ts";

/**
 * 後台的權限閘門（users.is_admin）：未登入顯示登入卡、不是管理者顯示 403。
 * 閘門直接蓋在原網址上，登入後留在同一頁；真正的防線在後端 /admin/* 的 RequireAdmin
 */
export function BackendAdminGate({ children }: { children: ReactNode }) {
  const { session, loading, submitting, login, logout } = useAuth();
  if (loading) return null;

  if (!session)
    return (
      <GateCard>
        <Typography component="h1" fontWeight={900} variant="h6">
          faryne.dev 後台
        </Typography>
        <Button
          disabled={submitting}
          onClick={() => void login()}
          size="large"
          startIcon={<GoogleIcon />}
          sx={{ textTransform: "none" }}
          variant="outlined"
        >
          使用 Google 登入
        </Button>
      </GateCard>
    );

  if (!session.user.is_admin)
    return (
      <GateCard>
        <Box>
          <Typography color="error" fontSize={40} fontWeight={900}>
            403
          </Typography>
          <Typography component="h1" fontWeight={900} variant="h6">
            需要管理者權限
          </Typography>
        </Box>
        {/* 登錯帳號時能直接換，不用先回前台找登出 */}
        <Stack direction="row" justifyContent="center" spacing={1}>
          <Button
            disabled={submitting}
            onClick={() => void logout()}
            variant="contained"
          >
            切換帳號
          </Button>
          <Button href="/" variant="outlined">
            回到網站
          </Button>
        </Stack>
      </GateCard>
    );

  return children;
}

function GateCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        variant="outlined"
        sx={{ maxWidth: 380, px: 3, py: 4, textAlign: "center", width: 1 }}
      >
        <Stack alignItems="center" spacing={2.5}>
          {children}
        </Stack>
      </Paper>
    </Box>
  );
}

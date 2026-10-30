import type { ReactNode } from "react";
import { Button, Paper, Typography } from "@mui/material";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

/** 主站管理頁的權限檢查（users.is_admin）：未登入顯示登入、不是管理者顯示 403 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { session, loading, submitting, login } = useAuth();
  if (loading) return null;
  if (!session) {
    return (
      <Paper variant="outlined" sx={{ px: 2, py: 5, textAlign: "center" }}>
        <Typography fontWeight={900} variant="h6">
          需要管理者權限
        </Typography>
        <Button
          disabled={submitting}
          onClick={() => void login()}
          sx={{ mt: 2 }}
          variant="contained"
        >
          登入
        </Button>
      </Paper>
    );
  }
  if (!session.user.is_admin) {
    return <ErrorPage backUrl="/" code={403} message="需要管理者權限" />;
  }
  return children;
}

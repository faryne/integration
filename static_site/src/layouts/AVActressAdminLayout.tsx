import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { NavLink, Outlet } from "react-router-dom";
import { usePendingActressSubmissionCount } from "@/apis/av/actress_submission.ts";
import {
  avAdminSubmissionsPath,
  avAdminTopicsPath,
} from "@/helpers/avActressAdmin.ts";
import { AdminGuard } from "@/components/common/AdminGuard.tsx";

// 後台導覽：之後的女優管理功能都加在這裡；countPending：旁邊顯示待審核數
const navItems: { label: string; to: string; countPending?: boolean }[] = [
  { label: "上稿審核", to: avAdminSubmissionsPath, countPending: true },
  { label: "女優主題", to: avAdminTopicsPath },
];

/**
 * 女優管理後台 layout：左側導覽＋子頁（上稿審核、女優主題），權限閘門在這裡（users.is_admin）。
 * 版面沿用 SteamLoom 管理後台（StorytellerAdminLayout），手機收成橫向分頁
 */
export function AVActressAdminLayout() {
  return (
    <AdminGuard>
      <AdminShell />
    </AdminGuard>
  );
}

function AdminShell() {
  const pending = usePendingActressSubmissionCount(true);
  const pendingCount = pending.data ?? 0;

  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: { xs: 1, md: 3 },
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: "200px minmax(0, 1fr)",
        },
      }}
    >
      <Paper
        aria-label="女優管理後台"
        component="nav"
        sx={{ p: 1, position: { md: "sticky" }, top: { md: 88 } }}
        variant="outlined"
      >
        <Typography
          color="text.secondary"
          fontWeight={800}
          sx={{
            display: { xs: "none", md: "block" },
            pb: 1,
            px: 1,
            textAlign: "left",
          }}
          variant="caption"
        >
          女優管理後台
        </Typography>
        <Stack
          direction={{ xs: "row", md: "column" }}
          spacing={0.5}
          sx={{ overflowX: "auto" }}
        >
          {navItems.map((item) => (
            <Box
              component={NavLink}
              key={item.to}
              sx={{
                alignItems: "center",
                borderRadius: 1,
                color: "text.primary",
                display: "flex",
                fontWeight: 700,
                gap: 1,
                justifyContent: "space-between",
                px: 1.25,
                py: 1,
                textDecoration: "none",
                whiteSpace: "nowrap",
                "&.active": {
                  bgcolor: "action.selected",
                  color: "primary.main",
                },
              }}
              to={item.to}
            >
              {item.label}
              {item.countPending && pendingCount > 0 && (
                <Chip
                  color="error"
                  label={pendingCount}
                  size="small"
                  sx={{ height: 20 }}
                />
              )}
            </Box>
          ))}
        </Stack>
      </Paper>
      <Box sx={{ minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

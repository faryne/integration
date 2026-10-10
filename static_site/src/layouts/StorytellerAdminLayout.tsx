import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { NavLink, Outlet } from "react-router-dom";
import { useAdminMe, useAdminReports } from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";

// 後台導覽：之後的管理功能都加在這裡。permissions 要「全部」持有才顯示（跟後端 requirePlatform 同規則）；
// countPending：導覽項目旁顯示待處理檢舉數
const adminNavItems: {
  label: string;
  to: string;
  permissions: string[];
  countPending?: boolean;
}[] = [
  {
    label: "檢舉",
    to: "admin/reports",
    permissions: ["admin.report.read"],
    countPending: true,
  },
];

// 管理後台 layout：巢狀在 StorytellerLayout 底下（沿用站台標頭與外觀），負責左側導覽與權限閘門。
// 沒有任何平台權限就整頁顯示「沒有權限」、不渲染子頁；API 仍由後端每次檢查。
export function StorytellerAdminLayout() {
  const { session } = useAuth();
  const me = useAdminMe();
  const permissions = me.data?.permissions ?? [];
  const canReadReports = permissions.includes("admin.report.read");
  // 導覽上的待處理數，跟列表頁預設查詢共用快取
  const pending = useAdminReports(
    { status: "pending", page: 1 },
    canReadReports,
  );

  if (session && me.isLoading) {
    return <StorytellerLoading label="正在確認權限..." />;
  }
  if (!session || permissions.length === 0) {
    // 權限查詢失敗時不要誤顯示成「沒有權限」
    const failed = me.isError;
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: "center", mt: 3 }}>
        <Typography variant="h6" fontWeight={800}>
          {failed ? "無法確認權限" : "沒有權限"}
        </Typography>
        <Typography color="text.secondary">
          {failed
            ? apiErrorMessage(me.error, "請稍後再試。")
            : "這個頁面只開放給站方管理員。"}
        </Typography>
      </Paper>
    );
  }
  const pendingCount = canReadReports ? (pending.data?.counts.pending ?? 0) : 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: "200px minmax(0, 1fr)",
        },
        gap: { xs: 1, md: 3 },
        alignItems: "start",
      }}
    >
      <Paper
        variant="outlined"
        component="nav"
        aria-label="管理後台"
        sx={{
          position: { md: "sticky" },
          top: { md: 88 },
          mt: { md: 3 },
          p: 1,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={800}
          sx={{ display: { xs: "none", md: "block" }, px: 1, pb: 1 }}
        >
          管理後台
        </Typography>
        {/* 手機收成橫向分頁 */}
        <Stack
          direction={{ xs: "row", md: "column" }}
          spacing={0.5}
          sx={{ overflowX: "auto" }}
        >
          {adminNavItems
            .filter((item) =>
              item.permissions.every((key) => permissions.includes(key)),
            )
            .map((item) => (
              <Box
                key={item.to}
                component={NavLink}
                to={steamloomPath(item.to)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1,
                  color: "text.primary",
                  textDecoration: "none",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  "&.active": {
                    bgcolor: "action.selected",
                    color: "primary.main",
                  },
                }}
              >
                {item.label}
                {item.countPending && pendingCount > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    label={pendingCount}
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

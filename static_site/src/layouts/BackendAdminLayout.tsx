import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  Box,
  Drawer,
  GlobalStyles,
  LinearProgress,
  ThemeProvider,
} from "@mui/material";

import { useAuth } from "@/components/auth/AuthContext.ts";
import { BackendAdminBreadcrumbs } from "@/components/backendAdmin/BackendAdminBreadcrumbs.tsx";
import { BackendAdminGate } from "@/components/backendAdmin/BackendAdminGate.tsx";
import { BackendAdminSideNav } from "@/components/backendAdmin/BackendAdminSideNav.tsx";
import {
  BACKEND_ADMIN_TOPBAR_HEIGHT,
  BackendAdminTopBar,
} from "@/components/backendAdmin/BackendAdminTopBar.tsx";
import { useBackendAdminDocument } from "@/components/backendAdmin/useBackendAdminDocument.ts";
import {
  siteColorModeStorageKey,
  siteTheme,
} from "@/components/common/siteLayout/siteTheme.ts";
import { SeoDisabledContext } from "@/helpers/title.tsx";
import "@/styles/common.css";

const SIDE_WIDTH = 232;

/**
 * 整合後台（/backend_admin）layout：不套主站 SiteLayout，自己的頂部列＋左側導覽＋麵包屑。
 * 主題與色彩模式跟主站共用（faryne-color-mode）；子頁的 useTitle 一律關掉，標題與 noindex 由 useBackendAdminDocument 統一處理
 */
export function BackendAdminLayout() {
  return (
    <ThemeProvider
      theme={siteTheme}
      defaultMode="system"
      modeStorageKey={siteColorModeStorageKey}
    >
      <GlobalStyles
        styles={(theme) => ({
          html: { colorScheme: theme.palette.mode },
          body: { backgroundColor: theme.palette.background.default },
        })}
      />
      <SeoDisabledContext.Provider value={true}>
        <BackendAdminFrame />
      </SeoDisabledContext.Provider>
    </ThemeProvider>
  );
}

function BackendAdminFrame() {
  useBackendAdminDocument();
  const { session } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        textAlign: "left",
      }}
    >
      {/* 頂部列在閘門外：登入卡與 403 也能切色彩模式；漢堡鈕只給管理者 */}
      <BackendAdminTopBar
        onMenuClick={
          session?.user.is_admin ? () => setDrawerOpen(true) : undefined
        }
      />
      <BackendAdminGate>
        <Box
          sx={{
            display: "grid",
            flex: 1,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: `${SIDE_WIDTH}px minmax(0, 1fr)`,
            },
          }}
        >
          {/* 桌機：固定在頂部列下方的側欄 */}
          <Box
            sx={{
              bgcolor: "background.paper",
              borderColor: "divider",
              borderRight: 1,
              display: { xs: "none", md: "block" },
              height: `calc(100vh - ${BACKEND_ADMIN_TOPBAR_HEIGHT}px)`,
              overflowY: "auto",
              position: "sticky",
              top: BACKEND_ADMIN_TOPBAR_HEIGHT,
            }}
          >
            <BackendAdminSideNav />
          </Box>
          <Box
            component="main"
            sx={{ minWidth: 0, px: { xs: 2, md: 3 }, py: 2.5 }}
          >
            <BackendAdminBreadcrumbs />
            {/* 子頁是 lazy load：只在內容區顯示載入條，外框不跟著閃 */}
            <Suspense fallback={<LinearProgress />}>
              <Outlet />
            </Suspense>
          </Box>
        </Box>
        {/* 手機：側欄收進 Drawer，點項目後自動收起 */}
        <Drawer
          onClose={closeDrawer}
          open={drawerOpen}
          slotProps={{ paper: { sx: { width: 260 } } }}
          sx={{ display: { md: "none" } }}
        >
          <BackendAdminSideNav onNavigate={closeDrawer} />
        </Drawer>
      </BackendAdminGate>
    </Box>
  );
}

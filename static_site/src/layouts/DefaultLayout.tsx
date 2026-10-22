import { Outlet } from "react-router-dom";
import { Box, Container, GlobalStyles, ThemeProvider } from "@mui/material";

import { SiteBreadcrumbs } from "@/components/common/siteLayout/SiteBreadcrumbs.tsx";
import { SiteFooter } from "@/components/common/siteLayout/SiteFooter.tsx";
import { SiteHeader } from "@/components/common/siteLayout/SiteHeader.tsx";
import {
  siteColorModeStorageKey,
  siteTheme,
} from "@/components/common/siteLayout/siteTheme.ts";
import "@/styles/common.css";

/** faryne.dev 內頁 layout：使用者可選跟隨系統／淺色／深色 */
export function DefaultLayout() {
  return (
    <ThemeProvider
      theme={siteTheme}
      defaultMode="system"
      modeStorageKey={siteColorModeStorageKey}
    >
      {/* 明確設定底色與 color-scheme，蓋過 index.css 的 Vite 預設深灰底 */}
      <GlobalStyles
        styles={(theme) => ({
          html: { colorScheme: theme.palette.mode },
          body: { backgroundColor: theme.palette.background.default },
        })}
      />
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
          color: "text.primary",
        }}
      >
        <SiteHeader />
        <SiteBreadcrumbs />
        <Container
          component="main"
          maxWidth={false}
          sx={{ maxWidth: 1280, flex: "1 0 auto", py: 3 }}
        >
          <Outlet />
        </Container>
        <SiteFooter />
      </Box>
    </ThemeProvider>
  );
}

import { Outlet } from "react-router-dom";
import { Box, Container, GlobalStyles, ThemeProvider } from "@mui/material";

import {
  siteColorModeStorageKey,
  siteTheme,
} from "@/components/common/siteLayout/siteTheme.ts";
import { JoyuBreadcrumbs } from "@/components/joyu/JoyuBreadcrumbs.tsx";
import { JoyuFooter } from "@/components/joyu/JoyuFooter.tsx";
import { JoyuHeader } from "@/components/joyu/JoyuHeader.tsx";
import "@/styles/common.css";

/**
 * joyu.fyi（AV 女優資料站）layout：版型與色彩模式沿用主站 DefaultLayout，頁首、麵包屑、頁尾換成 joyu 自己的。
 * 成人內容標記（meta rating）由 build 時的 vite-plugins/joyuSite.ts 寫進 index.html；
 * 18 歲確認維持在各頁面的 AgeConfirmationGate（確認狀態本來就共用，不用搬到這層）。
 */
export function JoyuLayout() {
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
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
          color: "text.primary",
        }}
      >
        <JoyuHeader />
        <JoyuBreadcrumbs />
        <Container
          component="main"
          maxWidth={false}
          sx={{ maxWidth: 1280, flex: "1 0 auto", py: 3 }}
        >
          <Outlet />
        </Container>
        <JoyuFooter />
      </Box>
    </ThemeProvider>
  );
}

import { Container, GlobalStyles, Stack, ThemeProvider } from "@mui/material";
import { Outlet } from "react-router-dom";

import { GalgameBottomNav } from "@/components/galgame/layout/GalgameBottomNav.tsx";
import { GalgameFooter } from "@/components/galgame/layout/GalgameFooter.tsx";
import { GalgameHeader } from "@/components/galgame/layout/GalgameHeader.tsx";
import { galgameBottomNavHeight } from "@/components/galgame/layout/galgameNavigation.ts";
import { useGalgameTheme } from "@/components/galgame/layout/galgameTheme.ts";

export function GalgameLayout() {
  const theme = useGalgameTheme();
  return (
    <ThemeProvider theme={theme}>
      {/* 明確設定底色與 color-scheme，不依賴瀏覽器預設 canvas（捲動回彈、捲軸也跟著深淺色） */}
      <GlobalStyles
        styles={{
          html: { colorScheme: theme.palette.mode },
          body: { backgroundColor: theme.palette.background.default },
        }}
      />
      <Stack
        minHeight="100vh"
        sx={{
          bgcolor: "background.default",
          color: "text.primary",
          // 手機版底部導覽是 fixed，保留同高度空間讓頁尾不被蓋住
          pb: { xs: `${galgameBottomNavHeight}px`, md: 0 },
        }}
      >
        <GalgameHeader />
        <Container component="main" maxWidth="lg" sx={{ flex: 1, py: 3 }}>
          <Outlet />
        </Container>
        <GalgameFooter />
        <GalgameBottomNav />
      </Stack>
    </ThemeProvider>
  );
}

import { Link, useLocation } from "react-router-dom";
import { Box, Container, Typography } from "@mui/material";

import { ColorModeMenu } from "@/components/common/siteLayout/ColorModeMenu.tsx";
import {
  SITE_HEADER_HEIGHT,
  siteInk,
} from "@/components/common/siteLayout/siteTheme.ts";
import { JOYU_SITE_NAME } from "@/helpers/joyu.ts";

import { findJoyuSection, joyuNavItems } from "./joyuNavigation.ts";

/**
 * joyu.fyi 頁首：沿用主站的墨色列樣式，但不帶 faryne.dev 品牌；只有三個區塊，手機也直接排開不用抽屜。
 * 目前不提供登入（之後做社群功能時才接 joyu-firebase 的 Auth），所以沒有帳號選單。
 */
export function JoyuHeader() {
  const { pathname } = useLocation();
  const current = findJoyuSection(pathname);

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        background: siteInk.bg,
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${siteInk.line}`,
        color: siteInk.text,
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1280,
          height: SITE_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, md: 3.5 },
        }}
      >
        <Box
          component={Link}
          to="/"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "inherit",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src="/joyu-icon-256.png"
            alt=""
            width={28}
            height={28}
            sx={{ borderRadius: 1 }}
          />
          <Typography
            sx={{
              display: { xs: "none", sm: "block" },
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {JOYU_SITE_NAME}
          </Typography>
        </Box>

        <Box component="nav" sx={{ display: "flex", alignSelf: "stretch" }}>
          {joyuNavItems.map((item) => (
            <Box
              key={item.href}
              component={Link}
              to={item.href}
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                px: { xs: 1, md: 1.5 },
                fontSize: 14,
                color: item === current ? siteInk.glow : siteInk.text,
                textDecoration: "none",
                whiteSpace: "nowrap",
                "&:hover": { color: siteInk.glow },
                // 目前所在區塊：底部光條，跟主站 header 同一套
                ...(item === current && {
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    left: 8,
                    right: 8,
                    bottom: -1,
                    height: 2,
                    borderRadius: 1,
                    bgcolor: siteInk.glow,
                    boxShadow: `0 0 10px ${siteInk.glow}`,
                  },
                }),
              }}
            >
              {item.title}
            </Box>
          ))}
        </Box>

        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          <ColorModeMenu />
        </Box>
      </Container>
    </Box>
  );
}

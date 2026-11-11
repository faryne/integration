import { Link, useLocation } from "react-router-dom";
import { Box, Container, IconButton, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { ColorModeMenu } from "@/components/common/siteLayout/ColorModeMenu.tsx";
import { SITE_HEADER_HEIGHT } from "@/components/common/siteLayout/siteTheme.ts";
import { JOYU_SITE_NAME, joyuPath } from "@/helpers/joyu.ts";

import { JoyuAccountMenu } from "./auth/JoyuAccountMenu.tsx";
import { JoyuSearchBox } from "./JoyuSearchBox.tsx";
import { findJoyuSection, joyuNavItems } from "./joyuNavigation.ts";
import { joyuInk } from "./joyuTheme.ts";

/**
 * joyu.fyi 頁首：深紫底＋粉紅強調（joyu 自己的配色）；三個區塊在手機上也直接排開。
 * 搜尋框桌機直接輸入（番號到影片頁、名字到女優搜尋），手機只放圖示連到女優搜尋。
 * 帳號區是 joyu-firebase 的登入（Google＋匿名），見 components/joyu/auth。
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
        background: joyuInk.bg,
        borderBottom: `1px solid ${joyuInk.line}`,
        color: joyuInk.text,
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1280,
          height: SITE_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, md: 3 },
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
                color: item === current ? joyuInk.accent : joyuInk.text,
                textDecoration: "none",
                whiteSpace: "nowrap",
                "&:hover": { color: joyuInk.accent },
                // 目前所在區塊：底部粉紅光條
                ...(item === current && {
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    left: 8,
                    right: 8,
                    bottom: 0,
                    height: 2,
                    borderRadius: 1,
                    bgcolor: joyuInk.accent,
                  },
                }),
              }}
            >
              {item.title}
            </Box>
          ))}
        </Box>

        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ display: { xs: "none", md: "block" }, width: 260 }}>
            <JoyuSearchBox variant="header" />
          </Box>
          <IconButton
            aria-label="搜尋"
            component={Link}
            to={joyuPath("actress")}
            sx={{ display: { md: "none" }, color: joyuInk.text }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
          <JoyuAccountMenu />
          <ColorModeMenu />
        </Box>
      </Container>
    </Box>
  );
}

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Box,
  ButtonBase,
  ClickAwayListener,
  Container,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuIcon from "@mui/icons-material/Menu";

import { FaryneLogo } from "@/components/common/FaryneLogo.tsx";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import { findSiteNavigationMatch } from "@/helpers/siteNavigation.ts";
import type { LayoutDropMenu } from "@/types/layout.ts";

import { ColorModeMenu } from "./ColorModeMenu.tsx";
import { headerIconButtonSx } from "./headerStyles.ts";
import { SiteAccountMenu } from "./SiteAccountMenu.tsx";
import { SiteMegaMenu } from "./SiteMegaMenu.tsx";
import { SiteNavDrawer } from "./SiteNavDrawer.tsx";
import { ExternalMark, SiteNavLink } from "./SiteNavLink.tsx";
import { SITE_HEADER_HEIGHT, siteInk } from "./siteTheme.ts";

interface SiteHeaderProps {
  /** 是否顯示色彩模式切換；首頁 LabLayout 固定深色所以不顯示（也不在 ThemeProvider 內） */
  showColorMode?: boolean;
}

/** faryne.dev 共用 header：墨色列＋mega menu，首頁與內頁共用 */
export function SiteHeader({ showColorMode = true }: SiteHeaderProps) {
  const { pathname } = useLocation();
  const match = findSiteNavigationMatch(pathname);
  // 記下展開時的路徑，換頁後自動視為收起，不用另外監聽路由
  const [opened, setOpened] = useState<{
    menu: LayoutDropMenu;
    path: string;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openMenu = opened?.path === pathname ? opened.menu : null;
  const closeMenu = () => setOpened(null);

  const navItemSx = {
    position: "relative",
    height: "100%",
    px: 1.5,
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    fontSize: 14,
    color: siteInk.text,
    "&:hover": { color: siteInk.glow },
  };
  // 目前所在分類：底部青綠光條
  const currentSx = {
    "&::after": {
      content: '""',
      position: "absolute",
      left: 12,
      right: 12,
      bottom: -1,
      height: 2,
      borderRadius: 1,
      bgcolor: siteInk.glow,
      boxShadow: `0 0 10px ${siteInk.glow}`,
    },
  };

  return (
    <ClickAwayListener onClickAway={closeMenu}>
      <Box
        component="header"
        onKeyDown={(e) => e.key === "Escape" && closeMenu()}
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
            gap: { xs: 1.25, md: 3.5 },
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              color: "inherit",
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <FaryneLogo width={30} style={{ borderRadius: 8 }} />
            <Box>
              <Typography
                sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}
              >
                Faryne 的實驗室
              </Typography>
              <Typography
                sx={{
                  display: { xs: "none", md: "block" },
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  color: siteInk.textMuted,
                }}
              >
                faryne.dev
              </Typography>
            </Box>
          </Box>

          <Box
            component="nav"
            sx={{ display: { xs: "none", md: "flex" }, alignSelf: "stretch" }}
          >
            {headerNavigationItems.map((nav) =>
              isLayoutDropMenu(nav) ? (
                <ButtonBase
                  key={nav.title}
                  aria-haspopup="true"
                  aria-expanded={openMenu === nav}
                  onClick={() =>
                    setOpened(
                      openMenu === nav ? null : { menu: nav, path: pathname },
                    )
                  }
                  sx={[
                    navItemSx,
                    nav === match?.group && currentSx,
                    openMenu === nav && { color: siteInk.glow },
                  ]}
                >
                  {nav.title}
                  <KeyboardArrowDownIcon
                    sx={{
                      fontSize: 16,
                      opacity: 0.7,
                      transition: "transform .15s",
                      transform:
                        openMenu === nav ? "rotate(180deg)" : undefined,
                    }}
                  />
                </ButtonBase>
              ) : (
                <SiteNavLink
                  key={nav.title}
                  item={nav}
                  onClick={closeMenu}
                  sx={navItemSx}
                >
                  {nav.title}
                  {nav.external && <ExternalMark />}
                </SiteNavLink>
              ),
            )}
          </Box>

          <Box
            sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}
          >
            {match?.item.requiresAuth && (
              <SiteAccountMenu links={match.item.accountLinks} />
            )}
            {showColorMode && <ColorModeMenu />}
            <IconButton
              aria-label="選單"
              onClick={() => setDrawerOpen((v) => !v)}
              sx={[headerIconButtonSx, { display: { md: "none" } }]}
            >
              {drawerOpen ? (
                <CloseIcon fontSize="small" />
              ) : (
                <MenuIcon fontSize="small" />
              )}
            </IconButton>
          </Box>
        </Container>

        {openMenu && (
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <SiteMegaMenu
              menu={openMenu}
              current={match?.item}
              onClose={closeMenu}
            />
          </Box>
        )}
        <SiteNavDrawer
          open={drawerOpen}
          match={match}
          onClose={() => setDrawerOpen(false)}
        />
      </Box>
    </ClickAwayListener>
  );
}

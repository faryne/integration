import { Link } from "react-router-dom";
import { Box, IconButton, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "@/components/auth/AuthContext.ts";
import { ColorModeMenu } from "@/components/common/siteLayout/ColorModeMenu.tsx";
import { headerIconButtonSx } from "@/components/common/siteLayout/headerStyles.ts";
import { SiteAccountMenu } from "@/components/common/siteLayout/SiteAccountMenu.tsx";
import { siteInk } from "@/components/common/siteLayout/siteTheme.ts";
import { BACKEND_ADMIN_PATH } from "@/helpers/backendAdmin.ts";

/** 帳號選單只多一個「回到網站」，登出由 SiteAccountMenu 本身提供 */
const accountLinks = [{ title: "回到網站", href: "/" }];

export const BACKEND_ADMIN_TOPBAR_HEIGHT = 56;

/** 後台頂部列：沿用主站 header 的墨色調與色彩模式／帳號選單；onMenuClick 有給時（手機）顯示漢堡鈕 */
export function BackendAdminTopBar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const { user } = useAuth();
  return (
    <Box
      component="header"
      sx={{
        alignItems: "center",
        bgcolor: siteInk.bg,
        borderBottom: `1px solid ${siteInk.line}`,
        color: siteInk.text,
        display: "flex",
        gap: 1.5,
        height: BACKEND_ADMIN_TOPBAR_HEIGHT,
        position: "sticky",
        px: 2,
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      {onMenuClick && (
        <IconButton
          aria-label="開啟後台選單"
          onClick={onMenuClick}
          sx={{ ...headerIconButtonSx, display: { md: "none" } }}
        >
          <MenuIcon fontSize="small" />
        </IconButton>
      )}
      <Typography
        component={Link}
        sx={{ color: "inherit", fontWeight: 900, textDecoration: "none" }}
        to={BACKEND_ADMIN_PATH}
      >
        faryne.dev
        <Box
          component="span"
          sx={{ color: siteInk.glow, fontSize: 13, fontWeight: 700, ml: 0.75 }}
        >
          後台
        </Box>
      </Typography>
      <Box sx={{ flex: 1 }} />
      <ColorModeMenu />
      {/* 未登入時登入按鈕在登入卡上，頂部列不重複放 */}
      {user && <SiteAccountMenu links={accountLinks} />}
    </Box>
  );
}

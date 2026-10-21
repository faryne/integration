import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import VideoLibraryOutlinedIcon from "@mui/icons-material/VideoLibraryOutlined";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { GalgameSubmitMenu } from "@/components/galgame/layout/GalgameSubmitMenu.tsx";
import {
  galgameBottomNavHeight,
  galgameNavItems,
  isGalgameNavActive,
} from "@/components/galgame/layout/galgameNavigation.ts";
import { galgamePath } from "@/helpers/galgame.ts";

const icons = {
  videos: <VideoLibraryOutlinedIcon />,
  brands: <StorefrontOutlinedIcon />,
  favorites: <StarBorderIcon />,
};

/** 手機版（md 以下）的底部導覽：影片／品牌／收藏／投稿 */
export function GalgameBottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [submitAnchor, setSubmitAnchor] = useState<HTMLElement | null>(null);
  const active =
    galgameNavItems.find((item) => isGalgameNavActive(pathname, item.path))
      ?.key ?? false;

  return (
    <Paper
      elevation={3}
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <BottomNavigation
        showLabels
        value={active}
        sx={{ height: galgameBottomNavHeight }}
      >
        {galgameNavItems.map((item) => (
          <BottomNavigationAction
            key={item.key}
            value={item.key}
            label={t(`galgame.layout.nav.${item.key}`)}
            icon={icons[item.key]}
            component={RouterLink}
            to={galgamePath(item.path)}
          />
        ))}
        <BottomNavigationAction
          value="submit"
          label={t("galgame.layout.nav.submit")}
          icon={<AddCircleOutlineIcon />}
          onClick={(event) => setSubmitAnchor(event.currentTarget)}
        />
      </BottomNavigation>
      <GalgameSubmitMenu
        anchorEl={submitAnchor}
        onClose={() => setSubmitAnchor(null)}
      />
    </Paper>
  );
}

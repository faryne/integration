import LoginIcon from "@mui/icons-material/Login";
import {
  Avatar,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "@/components/auth/AuthContext.ts";
import { galgameSubmitItems } from "@/components/galgame/layout/galgameNavigation.ts";
import { galgamePath } from "@/helpers/galgame.ts";

/** 頭像選單：收我的最愛、投稿、管理後台（限管理員）與登出；未登入時只顯示登入按鈕 */
export function GalgameUserMenu() {
  const { t } = useTranslation();
  const { user, session, loading, submitting, login, logout } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  if (loading) {
    return null;
  }
  if (!user) {
    return (
      <Tooltip title={t("galgame.layout.auth.login")}>
        <IconButton
          color="inherit"
          onClick={() => void login()}
          disabled={submitting}
        >
          <LoginIcon />
        </IconButton>
      </Tooltip>
    );
  }

  const links = [
    { key: "favorites", path: "favorites" },
    ...galgameSubmitItems,
    ...(session?.user.is_admin ? [{ key: "admin", path: "admin" }] : []),
  ];
  return (
    <>
      <Tooltip
        title={
          user.displayName ?? user.email ?? t("galgame.layout.auth.signedIn")
        }
      >
        <IconButton
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label={t("galgame.layout.auth.menu")}
          aria-expanded={Boolean(anchor)}
        >
          <Avatar
            src={user.photoURL ?? undefined}
            alt={user.displayName ?? t("galgame.layout.auth.userAvatar")}
            sx={{ width: 32, height: 32 }}
          />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {links.map((item) => (
          <MenuItem
            key={item.key}
            component={RouterLink}
            to={galgamePath(item.path)}
            onClick={close}
          >
            {t(`galgame.layout.nav.${item.key}`)}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          disabled={submitting}
          onClick={() => {
            close();
            void logout();
          }}
        >
          {t("galgame.layout.auth.logout")}
        </MenuItem>
      </Menu>
    </>
  );
}

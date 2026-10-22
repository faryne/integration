import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

import { useAuth } from "@/components/auth/AuthContext.ts";
import type { LayoutMenuItem } from "@/types/layout.ts";

import { headerMenuPaperSx } from "./headerStyles.ts";
import { siteInk } from "./siteTheme.ts";

/** 需要登入的功能才掛上：未登入顯示「登入」，登入後是頭像＋帳號選單（links 只放站內連結） */
export function SiteAccountMenu({ links = [] }: { links?: LayoutMenuItem[] }) {
  const { user, loading, submitting, login, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const close = () => setAnchorEl(null);

  if (loading) return null;

  if (!user)
    return (
      <Button
        onClick={() => void login()}
        disabled={submitting}
        aria-label="使用 Google 登入"
        sx={{
          height: 34,
          minWidth: 0,
          px: { xs: 0.75, md: 1.5 },
          gap: 1,
          borderRadius: 2,
          border: "1px solid rgba(114, 255, 240, 0.45)",
          bgcolor: "rgba(9, 22, 28, 0.6)",
          color: siteInk.text,
          "&:hover": { borderColor: siteInk.glow, color: siteInk.glow },
        }}
      >
        <GoogleIcon sx={{ fontSize: 18 }} />
        {/* 手機寬度只留 G 圖示 */}
        <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
          登入
        </Box>
      </Button>
    );

  const name = user.displayName ?? "使用者";
  return (
    <>
      <IconButton
        aria-label="帳號選單"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ p: 0 }}
      >
        <Avatar
          src={user.photoURL ?? undefined}
          alt={name}
          sx={{
            width: 34,
            height: 34,
            border: "2px solid rgba(114, 255, 240, 0.5)",
          }}
        />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { ...headerMenuPaperSx, minWidth: 220 } } }}
      >
        <Box
          sx={{
            display: "flex",
            gap: 1.25,
            alignItems: "center",
            px: 2,
            py: 1,
          }}
        >
          <Avatar
            src={user.photoURL ?? undefined}
            alt={name}
            sx={{ width: 38, height: 38 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
              {name}
            </Typography>
            <Typography sx={{ fontSize: 12, color: siteInk.textMuted }} noWrap>
              {user.email}
            </Typography>
          </Box>
        </Box>
        <Divider />
        {links.map((link) => (
          <MenuItem
            key={link.href}
            component={Link}
            to={link.href}
            onClick={close}
          >
            {link.title}
          </MenuItem>
        ))}
        <MenuItem
          disabled={submitting}
          onClick={() => {
            close();
            void logout();
          }}
        >
          登出
        </MenuItem>
      </Menu>
    </>
  );
}

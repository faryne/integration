import {
  AppBar,
  Avatar,
  Button,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  Menu,
  MenuItem,
  Box,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import { useState, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import { type LayoutDropMenu, type LayoutMenuItem } from "@/types/layout.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";

export interface HeaderProps {
  fullWidth?: boolean;
}

export function Header({ fullWidth = false }: HeaderProps) {
  const [openedMenu, setOpenedMenu] = useState<LayoutDropMenu | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const defaultButtonCss = { color: "white" };
  const { pathname } = useLocation();
  // 登入按鈕只在 ETF 相關頁面顯示，其他功能不需要登入，維持現狀
  const showLoginButton = pathname.startsWith("/data/etf");
  const { user, loading, submitting, login, logout } = useAuth();

  const handleMenuOpen = (
    menu: LayoutDropMenu,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setOpenedMenu(menu);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setOpenedMenu(null);
    setAnchorEl(null);
  };

  const renderButton = (item: LayoutMenuItem) => (
    <Button
      key={item.title}
      sx={defaultButtonCss}
      component={"a"}
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
    >
      {item.title}
    </Button>
  );

  return (
    <>
      <AppBar
        position={"fixed"}
        sx={{
          top: 0,
          left: "50%",
          right: "auto",
          width: fullWidth ? "100%" : "1280px",
          transform: "translateX(-50%)",
          mx: "auto",
        }}
      >
        <Toolbar>
          <Typography variant={"subtitle1"}>Faryne的實驗室</Typography>
          {headerNavigationItems.map((item) =>
            isLayoutDropMenu(item) ? (
              <Button
                key={item.title}
                sx={defaultButtonCss}
                variant={"outlined"}
                endIcon={<KeyboardArrowDownIcon />}
                aria-haspopup={"menu"}
                aria-expanded={openedMenu?.title === item.title}
                onClick={(event) => handleMenuOpen(item, event)}
              >
                {item.title}
              </Button>
            ) : (
              renderButton(item)
            ),
          )}
          <Menu
            open={!!openedMenu}
            anchorEl={anchorEl}
            onClose={handleMenuClose}
          >
            {openedMenu?.items.map((item) => (
              <MenuItem
                key={item.title}
                component={"a"}
                onClick={handleMenuClose}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
              >
                {item.title}
              </MenuItem>
            ))}
          </Menu>
          {showLoginButton && !loading && (
            <Box sx={{ ml: "auto", pl: 2 }}>
              {user ? (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Tooltip title={user.displayName ?? user.email ?? "已登入"}>
                    <Avatar
                      src={user.photoURL ?? undefined}
                      alt={user.displayName ?? "使用者"}
                      sx={{ width: 32, height: 32 }}
                    />
                  </Tooltip>
                  <Tooltip title="登出">
                    <IconButton
                      sx={defaultButtonCss}
                      onClick={() => void logout()}
                      disabled={submitting}
                    >
                      <LogoutIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                <Tooltip title="使用 Google 登入">
                  <IconButton
                    sx={defaultButtonCss}
                    onClick={() => void login()}
                    disabled={submitting}
                  >
                    <LoginIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Box sx={{ height: 20 }} />
    </>
  );
}

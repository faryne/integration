import { useAuth } from "@/components/auth/AuthContext.ts";
import { PenNameDialog } from "@/components/storyteller/PenNameDialog.tsx";
import { useStorytellerUserProfile } from "@/apis/storyteller.ts";
import IndependentFooter from "@/components/common/IndependentFooter.tsx";
import {
  StorytellerThemeModeContext,
  getInitialStorytellerThemeMode,
  storytellerThemeModeStorageKey,
} from "@/layouts/storytellerThemeMode.tsx";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LightModeIcon from "@mui/icons-material/LightMode";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PersonIcon from "@mui/icons-material/Person";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  createTheme,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Outlet } from "react-router-dom";

export function StorytellerLayout() {
  const { user, session, loading, submitting, login, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 深色模式套用在整個 Storyteller 產品線（不影響其他子站），記在 localStorage 供下次造訪沿用
  const [mode, setMode] = useState(getInitialStorytellerThemeMode);
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);
  useEffect(() => {
    window.localStorage.setItem(storytellerThemeModeStorageKey, mode);
  }, [mode]);
  const toggleMode = () =>
    setMode((value) => (value === "dark" ? "light" : "dark"));
  const { data: profile, isLoading: isProfileLoading } =
    useStorytellerUserProfile();
  const displayName =
    session?.user.display_name ?? user?.displayName ?? user?.email ?? "使用者";
  const photoURL = session?.user.photo_url ?? user?.photoURL ?? undefined;

  const showPenNameDialog =
    Boolean(session) && !isProfileLoading && profile && !profile.pen_name;

  const menuItems = [
    { label: "公開故事", to: "/storyteller", icon: <AutoStoriesIcon /> },
    { label: "我的工作台", to: "/storyteller/my", icon: <AutoStoriesIcon /> },
    { label: "我的收藏", to: "/storyteller/favorites", icon: <FavoriteIcon /> },
    { label: "作者設定", to: "/storyteller/profile", icon: <PersonIcon /> },
  ];

  return (
    <ThemeProvider theme={theme}>
      <StorytellerThemeModeContext.Provider value={{ mode, toggleMode }}>
        <Stack sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
          <PenNameDialog open={Boolean(showPenNameDialog)} />
          <Drawer
            anchor="left"
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          >
            <Box sx={{ width: 250, p: 2 }}>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2, px: 2 }}>
                Storyteller
              </Typography>
              <Divider />
              <List>
                {menuItems.map((item) => (
                  <ListItem key={item.to} disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Drawer>
          <AppBar position="sticky" color="default" elevation={0}>
            <Toolbar>
              <IconButton
                edge="start"
                color="inherit"
                aria-label="menu"
                sx={{ mr: 2, display: { md: "none" } }}
                onClick={() => setMobileMenuOpen(true)}
              >
                <MenuIcon />
              </IconButton>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ flex: 1 }}
              >
                <AutoStoriesIcon color="primary" />
                <Typography
                  component={RouterLink}
                  to="/storyteller"
                  variant="h6"
                  fontWeight={800}
                  sx={{ color: "inherit", textDecoration: "none" }}
                >
                  Storyteller
                </Typography>
                <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
                  {menuItems.map((item) => (
                    <Button
                      key={item.to}
                      component={RouterLink}
                      to={item.to}
                      size="small"
                      startIcon={item.icon}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Box>
              </Stack>
              <Tooltip
                title={mode === "dark" ? "切換為日間模式" : "切換為夜間模式"}
              >
                <IconButton
                  aria-label={
                    mode === "dark" ? "切換為日間模式" : "切換為夜間模式"
                  }
                  color="inherit"
                  onClick={toggleMode}
                  sx={{ mr: 1 }}
                >
                  {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              {session ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="body2"
                    sx={{ display: { xs: "none", sm: "block" } }}
                  >
                    {displayName}
                  </Typography>
                  <Tooltip title={displayName}>
                    <Avatar
                      src={photoURL}
                      alt={displayName}
                      sx={{ width: 32, height: 32 }}
                    />
                  </Tooltip>
                  <Tooltip title="登出">
                    <IconButton
                      color="inherit"
                      disabled={submitting}
                      onClick={() => void logout()}
                    >
                      <LogoutIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<LoginIcon />}
                  disabled={loading || submitting}
                  onClick={() => void login()}
                >
                  登入
                </Button>
              )}
            </Toolbar>
          </AppBar>
          <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3 }}>
            <Outlet />
          </Container>
          <Container component="footer" maxWidth="xl">
            <Divider />
            <IndependentFooter service_name="StoryTeller" />
          </Container>
        </Stack>
      </StorytellerThemeModeContext.Provider>
    </ThemeProvider>
  );
}

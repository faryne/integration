import { useAuth } from "@/components/auth/AuthContext.ts";
import { PenNameDialog } from "@/components/storyteller/PenNameDialog.tsx";
import { SteamLoomMark } from "@/components/storyteller/SteamGearIcon.tsx";
import { useStorytellerUserProfile } from "@/apis/storyteller.ts";
import IndependentFooter from "@/components/common/IndependentFooter.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import {
  storytellerDisplayFontFamily,
  storytellerMonoFontFamily,
  storytellerThemeTokens,
} from "@/data/storytellerTheme.ts";
import {
  StorytellerThemeModeContext,
  getInitialStorytellerThemeMode,
  storytellerThemeModeStorageKey,
} from "@/layouts/storytellerThemeMode.tsx";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LightModeIcon from "@mui/icons-material/LightMode";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  createTheme,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
  const [accountMenuAnchor, setAccountMenuAnchor] =
    useState<HTMLElement | null>(null);
  // 深色模式套用在整個 Storyteller 產品線（不影響其他子站），記在 localStorage 供下次造訪沿用
  const [mode, setMode] = useState(getInitialStorytellerThemeMode);
  const theme = useMemo(() => {
    const tokens = storytellerThemeTokens[mode];
    const headingStyle = { fontFamily: storytellerDisplayFontFamily, fontWeight: 700 };
    return createTheme({
      palette: {
        mode,
        primary: { main: tokens.brass, light: tokens.brassBright, dark: tokens.copper },
        secondary: { main: tokens.copper },
        background: { default: tokens.bg, paper: tokens.surface },
        text: { primary: tokens.text, secondary: tokens.textMuted },
        divider: tokens.border,
      },
      shape: { borderRadius: 3 },
      typography: {
        h1: headingStyle,
        h2: headingStyle,
        h3: headingStyle,
        h4: headingStyle,
        h5: headingStyle,
        h6: headingStyle,
        button: {
          fontFamily: storytellerMonoFontFamily,
          fontWeight: 700,
          textTransform: "none",
          letterSpacing: "0.02em",
        },
      },
    });
  }, [mode]);
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

  const accountMenuItems = [
    { label: "我的工作台", to: "/storyteller/my", icon: <AutoStoriesIcon /> },
    { label: "我的收藏", to: "/storyteller/favorites", icon: <FavoriteIcon /> },
    { label: "我的檔案", to: "/storyteller/profile", icon: <PersonIcon /> },
  ];

  return (
    <ThemeProvider theme={theme}>
      <StorytellerThemeModeContext.Provider value={{ mode, toggleMode }}>
        <Stack sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
          <PenNameDialog open={Boolean(showPenNameDialog)} />
          <AppBar position="sticky" color="default" elevation={0}>
            <Toolbar>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ flex: 1 }}
              >
                <Box
                  sx={{
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <SteamLoomMark size={24} />
                </Box>
                <Typography
                  component={RouterLink}
                  to="/storyteller"
                  variant="h6"
                  sx={{
                    color: "inherit",
                    textDecoration: "none",
                    lineHeight: 1,
                  }}
                >
                  {STORYTELLER_APP_NAME}
                </Typography>
                <Tooltip
                  title={mode === "dark" ? "切換為日間模式" : "切換為夜間模式"}
                >
                  <IconButton
                    aria-label={
                      mode === "dark" ? "切換為日間模式" : "切換為夜間模式"
                    }
                    color="inherit"
                    onClick={toggleMode}
                    size="small"
                  >
                    {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                </Tooltip>
              </Stack>
              <Button
                component={RouterLink}
                to="/storyteller/my/project/new"
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                sx={{
                  mr: 1,
                  whiteSpace: "nowrap",
                  display: { xs: "none", sm: "inline-flex" },
                }}
              >
                建立故事專案
              </Button>
              <IconButton
                component={RouterLink}
                to="/storyteller/my/project/new"
                color="primary"
                aria-label="建立故事專案"
                sx={{ mr: 1, display: { xs: "inline-flex", sm: "none" } }}
              >
                <AddIcon />
              </IconButton>
              {session ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title="帳號選單">
                    <IconButton
                      onClick={(event) =>
                        setAccountMenuAnchor(event.currentTarget)
                      }
                      aria-label="帳號選單"
                      sx={{ borderRadius: 5, pr: 0.5 }}
                    >
                      <Avatar
                        src={photoURL}
                        alt={displayName}
                        sx={{ width: 32, height: 32 }}
                      />
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={accountMenuAnchor}
                    open={Boolean(accountMenuAnchor)}
                    onClose={() => setAccountMenuAnchor(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    <Box sx={{ px: 2, py: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {profile?.pen_name || displayName}
                      </Typography>
                    </Box>
                    <Divider />
                    {accountMenuItems.map((item) => (
                      <MenuItem
                        key={item.to}
                        component={RouterLink}
                        to={item.to}
                        onClick={() => setAccountMenuAnchor(null)}
                      >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                      </MenuItem>
                    ))}
                    <Divider />
                    <MenuItem
                      disabled={submitting}
                      onClick={() => {
                        setAccountMenuAnchor(null);
                        void logout();
                      }}
                    >
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="登出" />
                    </MenuItem>
                  </Menu>
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
            <IndependentFooter service_name={STORYTELLER_APP_NAME} />
          </Container>
        </Stack>
      </StorytellerThemeModeContext.Provider>
    </ThemeProvider>
  );
}

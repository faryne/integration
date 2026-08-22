import { useAuth } from "@/components/auth/AuthContext.ts";
import { PenNameDialog } from "@/components/storyteller/PenNameDialog.tsx";
import { SteamLoomMark } from "@/components/storyteller/SteamGearIcon.tsx";
import { SteamPaletteSwitcher } from "@/components/storyteller/SteamPaletteSwitcher.tsx";
import { WelcomeGuideDialog } from "@/components/storyteller/WelcomeGuideDialog.tsx";
import { useStorytellerUserProfile } from "@/apis/storyteller.ts";
import IndependentFooter from "@/components/common/IndependentFooter.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import {
  storytellerDisplayFontFamily,
  storytellerMonoFontFamily,
  storytellerThemeTokens,
} from "@/data/storytellerTheme.ts";
import {
  storytellerSemanticTokensToCssVariables,
  toStorytellerSemanticTokens,
} from "@/data/storytellerSemanticTheme.ts";
import { mergeStorytellerSeasonalTokens } from "@/data/storytellerSeasonalTheme.ts";
import { storytellerComponentOverrides } from "@/data/storytellerComponentOverrides.ts";
import {
  StorytellerPaletteContext,
  getInitialStorytellerPalette,
  storytellerPaletteStorageKey,
} from "@/layouts/storytellerPaletteMode.tsx";
import {
  StorytellerThemeModeContext,
  getInitialStorytellerThemeMode,
  storytellerThemeModeStorageKey,
} from "@/layouts/storytellerThemeMode.tsx";
import {
  StorytellerSeasonalContext,
  getInitialStorytellerSeason,
  storytellerSeasonalStorageKey,
} from "@/layouts/storytellerSeasonalMode.tsx";
import { isSteamLoomSite, steamloomPath } from "@/helpers/steamloom.ts";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LightModeIcon from "@mui/icons-material/LightMode";
import LoginIcon from "@mui/icons-material/Login";
import CloseIcon from "@mui/icons-material/Close";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  createTheme,
  Divider,
  GlobalStyles,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Outlet, useNavigate } from "react-router-dom";

export function StorytellerLayout() {
  const { user, session, loading, submitting, login, logout } = useAuth();
  const navigate = useNavigate();
  const [accountMenuAnchor, setAccountMenuAnchor] =
    useState<HTMLElement | null>(null);
  // 搜尋圖示點開才展開的輸入框，不佔用常駐 header 空間；送出後導去搜尋頁並收合。
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchKeyword, setQuickSearchKeyword] = useState("");

  function submitQuickSearch() {
    const keyword = quickSearchKeyword.trim();
    navigate(
      steamloomPath(
        keyword ? `search?keyword=${encodeURIComponent(keyword)}` : "search",
      ),
    );
    setQuickSearchOpen(false);
    setQuickSearchKeyword("");
  }
  // 深色模式套用在整個 Storyteller 產品線（不影響其他子站），記在 localStorage 供下次造訪沿用
  const [mode, setMode] = useState(getInitialStorytellerThemeMode);
  // 色系（黃銅／鋼鐵／銅綠／紅銅）也是整個產品線共用一份，記在 localStorage 供下次造訪沿用；
  // 齒輪、鉚釘這些機構本身不受色系影響，只有 storytellerThemeTokens 的色碼會變。
  const [palette, setPalette] = useState(getInitialStorytellerPalette);
  // Phase D：節慶主題（預設「無」，不影響任何人），疊在 palette/mode 決定的
  // base semantic token 上面，只覆寫少數強調色 key，見 storytellerSeasonalTheme.ts。
  const [season, setSeason] = useState(getInitialStorytellerSeason);
  const theme = useMemo(() => {
    const tokens = storytellerThemeTokens[palette][mode];
    const headingStyle = {
      fontFamily: storytellerDisplayFontFamily,
      fontWeight: 700,
    };
    return createTheme({
      // 開 CSS variables 模式：MUI 會把目前的 palette 值同步寫成 `--mui-palette-*`
      // 這種 CSS custom property，掛在 <html> 上。這樣手刻 DOM（不吃 MUI 元件、
      // 不在 React tree 裡用 sx 的那種，例如 slash 選單）也能直接用 var(...) 讀到
      // 當下的顏色，不用把顏色寫死或另外傳遞 theme context 進去——見已知 Bug 記錄
      // 第 7 項，slash 選單原本 background 寫死 #fff，深色模式下不會跟著變。
      cssVariables: true,
      palette: {
        mode,
        primary: {
          main: tokens.brass,
          light: tokens.brassBright,
          dark: tokens.copper,
        },
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
      // Phase B 第一批：Dialog/Menu/Tooltip/Button/IconButton 換皮，見
      // storytellerComponentOverrides.ts 說明。這組 override 不吃 tokens／
      // mode／palette，全部透過 CSS variable 解析，不用放進 useMemo 的
      // 依賴考量（跟 theme 一起在 [mode, palette] 變動時重建也沒差，純粹
      // 只是同一個 createTheme() 呼叫裡的靜態設定）。
      components: storytellerComponentOverrides(),
    });
  }, [mode, palette]);
  // Phase A（視覺主題規劃）：semantic token 曝露成 CSS variable，掛在 :root 上。
  // 跟 theme 用同一份 [mode, palette] 依賴、同一份 tokens 來源，確保兩邊永遠同步
  // ——不會有「MUI palette 已經換色系了，但 --storyteller-* 還是舊值」這種不一致。
  // Phase D：節慶 overlay 疊在 semantic token 這層（不是疊在 raw palette token
  // 上），所以只影響吃 --storyteller-* 的手刻 DOM／Phase B component override，
  // 不影響 MUI theme.palette.primary 本身（AppBar／contained Button 這類直接
  // 讀 tokens.brass 的地方維持色系本色，節慶只換裝飾性強調色，不是整站變色）。
  const storytellerCssVariables = useMemo(() => {
    const tokens = storytellerThemeTokens[palette][mode];
    return storytellerSemanticTokensToCssVariables(
      mergeStorytellerSeasonalTokens(
        toStorytellerSemanticTokens(tokens),
        season,
        mode,
      ),
    );
  }, [mode, palette, season]);
  useEffect(() => {
    window.localStorage.setItem(storytellerThemeModeStorageKey, mode);
  }, [mode]);
  useEffect(() => {
    window.localStorage.setItem(storytellerPaletteStorageKey, palette);
  }, [palette]);
  useEffect(() => {
    window.localStorage.setItem(storytellerSeasonalStorageKey, season);
  }, [season]);
  // index.html 的 favicon 是所有 Firebase Hosting target 共用的同一份靜態檔案，
  // steamloom.works 要有自己的圖示只能在 runtime 改 <link rel="icon">，跟 helpers/title.tsx
  // 動態改 document.head 是同一招；巢狀模式（faryne.dev/storyteller）維持原本的 faryne icon。
  useEffect(() => {
    if (!isSteamLoomSite()) {
      return;
    }
    let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.type = "image/svg+xml";
    icon.href = "/steamloom-icon.svg";
  }, []);
  const toggleMode = () =>
    setMode((value) => (value === "dark" ? "light" : "dark"));
  const { data: profile, isLoading: isProfileLoading } =
    useStorytellerUserProfile();
  const displayName =
    session?.user.display_name ?? user?.displayName ?? user?.email ?? "使用者";
  const photoURL = session?.user.photo_url ?? user?.photoURL ?? undefined;

  const showPenNameDialog =
    Boolean(session) && !isProfileLoading && profile && !profile.pen_name;
  // 只有「這次真的完成第一次筆名設定」才彈功能導覽（見 PenNameDialog 的 onCompleted
  // 說明），不是每次 showPenNameDialog 變化都跳——例如筆名已經設定過的老使用者，
  // showPenNameDialog 一開始就是 false，不會經過這個 callback。
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);

  const accountMenuItems = [
    { label: "我的工作台", to: steamloomPath("my"), icon: <AutoStoriesIcon /> },
    {
      label: "我的追蹤",
      to: steamloomPath("my/favorites"),
      icon: <FavoriteIcon />,
    },
    {
      label: "我的檔案",
      to: steamloomPath("my/profile"),
      icon: <PersonIcon />,
    },
  ];

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles styles={{ ":root": storytellerCssVariables }} />
      <StorytellerThemeModeContext.Provider value={{ mode, toggleMode }}>
        <StorytellerPaletteContext.Provider value={{ palette, setPalette }}>
          <StorytellerSeasonalContext.Provider value={{ season, setSeason }}>
            <Stack sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
              <PenNameDialog
                open={Boolean(showPenNameDialog)}
                onCompleted={() => setShowWelcomeGuide(true)}
              />
              <WelcomeGuideDialog
                open={showWelcomeGuide}
                onClose={() => setShowWelcomeGuide(false)}
              />
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
                      to={steamloomPath()}
                      variant="h6"
                      sx={{
                        color: "inherit",
                        textDecoration: "none",
                        lineHeight: 1,
                      }}
                    >
                      {STORYTELLER_APP_NAME}
                    </Typography>
                    {quickSearchOpen ? (
                      <Stack
                        component="form"
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitQuickSearch();
                        }}
                      >
                        <TextField
                          autoFocus
                          size="small"
                          variant="standard"
                          placeholder="搜尋作品..."
                          value={quickSearchKeyword}
                          onChange={(event) =>
                            setQuickSearchKeyword(event.target.value)
                          }
                          onBlur={() => {
                            if (!quickSearchKeyword.trim()) {
                              setQuickSearchOpen(false);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setQuickSearchOpen(false);
                              setQuickSearchKeyword("");
                            }
                          }}
                          sx={{ width: { xs: 120, sm: 200 } }}
                        />
                        <IconButton
                          type="submit"
                          aria-label="送出搜尋"
                          color="inherit"
                          size="small"
                        >
                          <SearchIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          aria-label="關閉搜尋"
                          color="inherit"
                          size="small"
                          onClick={() => {
                            setQuickSearchOpen(false);
                            setQuickSearchKeyword("");
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : (
                      <Tooltip title="搜尋作品">
                        <IconButton
                          aria-label="搜尋作品"
                          color="inherit"
                          size="small"
                          onClick={() => setQuickSearchOpen(true)}
                        >
                          <SearchIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip
                      title={
                        mode === "dark" ? "切換為日間模式" : "切換為夜間模式"
                      }
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
                    to={steamloomPath("my/projects/new")}
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    sx={{
                      mr: 1,
                      whiteSpace: "nowrap",
                      display: { xs: "none", sm: "inline-flex" },
                    }}
                  >
                    建立創作專案
                  </Button>
                  <IconButton
                    component={RouterLink}
                    to={steamloomPath("my/projects/new")}
                    color="primary"
                    aria-label="建立創作專案"
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
                        anchorOrigin={{
                          vertical: "bottom",
                          horizontal: "right",
                        }}
                        transformOrigin={{
                          vertical: "top",
                          horizontal: "right",
                        }}
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
                <SteamPaletteSwitcher />
              </Container>
            </Stack>
          </StorytellerSeasonalContext.Provider>
        </StorytellerPaletteContext.Provider>
      </StorytellerThemeModeContext.Provider>
    </ThemeProvider>
  );
}

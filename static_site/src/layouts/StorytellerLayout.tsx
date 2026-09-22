import { useAuth } from "@/components/auth/AuthContext.ts";
import { PenNameDialog } from "@/components/storyteller/PenNameDialog.tsx";
import { SteamLoomMark } from "@/components/storyteller/SteamLoomMark.tsx";
import { StorytellerAppearanceMenu } from "@/components/storyteller/StorytellerAppearanceMenu.tsx";
import { WelcomeGuideDialog } from "@/components/storyteller/WelcomeGuideDialog.tsx";
import { useStorytellerUserProfile } from "@/apis/storyteller.ts";
import IndependentFooter from "@/components/common/IndependentFooter.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import {
  storytellerAppearanceMeta,
  storytellerDisplayFontFamily,
  storytellerMonoFontFamily,
  storytellerThemeTokens,
} from "@/data/storytellerTheme.ts";
import {
  storytellerSemanticTokensToCssVariables,
  toStorytellerSemanticTokens,
} from "@/data/storytellerSemanticTheme.ts";
import { storytellerComponentOverrides } from "@/data/storytellerComponentOverrides.ts";
import {
  StorytellerAppearanceContext,
  getInitialStorytellerAppearance,
  removeLegacyStorytellerAppearancePreferences,
  storytellerAppearanceStorageKey,
} from "@/layouts/storytellerAppearanceMode.tsx";
import {
  StorytellerHeaderContext,
  type StorytellerReaderHeaderContext,
} from "@/layouts/StorytellerHeaderContext.tsx";
import { isSteamLoomSite, steamloomPath } from "@/helpers/steamloom.ts";
import { storytellerCoverObjectPosition } from "@/helpers/storytellerCover.ts";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LoginIcon from "@mui/icons-material/Login";
import CloseIcon from "@mui/icons-material/Close";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import {
  alpha,
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
import {
  Link as RouterLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

export function StorytellerLayout() {
  const { user, session, loading, submitting, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountMenuAnchor, setAccountMenuAnchor] =
    useState<HTMLElement | null>(null);
  // 搜尋圖示點開才展開的輸入框，不佔用常駐 header 空間；送出後導去搜尋頁並收合。
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchKeyword, setQuickSearchKeyword] = useState("");
  const [readerHeader, setReaderHeader] =
    useState<StorytellerReaderHeaderContext>();
  const headerContextValue = useMemo(
    () => ({ reader: readerHeader, setReader: setReaderHeader }),
    [readerHeader],
  );

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
  // 三種 appearance 已各自包含明暗與配色；舊版設定由 initializer 一次遷移。
  const [appearance, setAppearance] = useState(getInitialStorytellerAppearance);
  const mode = storytellerAppearanceMeta[appearance].mode;
  const theme = useMemo(() => {
    const tokens = storytellerThemeTokens[appearance];
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
          main: tokens.accent,
          light: tokens.accentBright,
          dark: tokens.support,
        },
        secondary: { main: tokens.accentSecondary },
        background: { default: tokens.bg, paper: tokens.surface },
        text: { primary: tokens.text, secondary: tokens.textMuted },
        divider: tokens.border,
      },
      shape: { borderRadius: 2 },
      typography: {
        fontFamily: storytellerMonoFontFamily,
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
      components: storytellerComponentOverrides(),
    });
  }, [appearance, mode]);
  // Semantic variables 同步提供給 editor 內不在 MUI tree 裡的原生選單。
  const storytellerCssVariables = useMemo(() => {
    const tokens = storytellerThemeTokens[appearance];
    return storytellerSemanticTokensToCssVariables(
      toStorytellerSemanticTokens(tokens),
    );
  }, [appearance]);
  useEffect(() => {
    window.localStorage.setItem(storytellerAppearanceStorageKey, appearance);
    removeLegacyStorytellerAppearancePreferences();
    document.documentElement.dataset.storytellerAppearance = appearance;
    document.documentElement.style.colorScheme = mode;
  }, [appearance, mode]);
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
  const { data: profile, isLoading: isProfileLoading } =
    useStorytellerUserProfile();
  const displayName =
    session?.user.display_name ?? user?.displayName ?? user?.email ?? "使用者";
  const photoURL = session?.user.photo_url ?? user?.photoURL ?? undefined;
  const workspaceRoot = steamloomPath("my/workspace");
  // 工作台本身是固定高度的 app shell，專案操作也已收進 navigator；普通網站 footer
  // 在這裡只會被壓在殼後或造成重複操作，僅保留給公開瀏覽與閱讀頁。這裡只能比對
  // workspace/:id 這條新版 app shell 的路由前綴，不能用整個 /my——/my 底下還有
  // 首頁、api-keys、favorites、profile 等一般可捲動頁面，也有 legacy 的
  // /my/project/:id 系列頁面，那些都要保留 footer。
  const showFooter =
    location.pathname !== workspaceRoot &&
    !location.pathname.startsWith(`${workspaceRoot}/`);

  const showPenNameDialog =
    Boolean(session) && !isProfileLoading && profile && !profile.pen_name;
  // 只有「這次真的完成第一次筆名設定」才彈功能導覽（見 PenNameDialog 的 onCompleted
  // 說明），不是每次 showPenNameDialog 變化都跳——例如筆名已經設定過的老使用者，
  // showPenNameDialog 一開始就是 false，不會經過這個 callback。
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const readerHeaderVisible = Boolean(readerHeader?.visible);

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
      <GlobalStyles
        styles={{
          ":root": storytellerCssVariables,
          body: {
            backgroundColor: "var(--storyteller-surface-base)",
            backgroundImage:
              "radial-gradient(circle at 8% 18%, color-mix(in srgb, var(--storyteller-accent-main) 10%, transparent), transparent 30rem)",
          },
        }}
      />
      <StorytellerAppearanceContext.Provider
        value={{ appearance, setAppearance }}
      >
        <StorytellerHeaderContext.Provider value={headerContextValue}>
          <Stack sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
            <PenNameDialog
              open={Boolean(showPenNameDialog)}
              onCompleted={() => setShowWelcomeGuide(true)}
            />
            <WelcomeGuideDialog
              open={showWelcomeGuide}
              onClose={() => setShowWelcomeGuide(false)}
            />
            <AppBar
              position="sticky"
              color="default"
              elevation={0}
              sx={{
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor:
                  "color-mix(in srgb, var(--storyteller-surface-base) 88%, transparent)",
                backdropFilter: "blur(18px)",
              }}
            >
              <Toolbar sx={{ minHeight: { xs: 60, sm: 68 } }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ flex: "1 1 0", minWidth: 0 }}
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
                      display: readerHeaderVisible
                        ? { xs: "none", md: "block" }
                        : "block",
                    }}
                  >
                    {STORYTELLER_APP_NAME}
                  </Typography>
                  {readerHeaderVisible && (
                    <Typography
                      noWrap
                      fontWeight={800}
                      sx={{ display: { xs: "block", md: "none" }, minWidth: 0 }}
                    >
                      {readerHeader?.title}
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    alignItems="center"
                    sx={{
                      display: readerHeaderVisible
                        ? { xs: "none", md: "flex" }
                        : "flex",
                    }}
                  >
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
                    <StorytellerAppearanceMenu />
                  </Stack>
                </Stack>
                {readerHeaderVisible && (
                  <Box
                    component="section"
                    aria-label="目前閱讀內容"
                    sx={[
                      readerHeader?.coverUrl
                        ? (theme) => ({
                            px: 1.5,
                            py: 0.75,
                            border: "1px solid",
                            borderColor: "divider",
                            backgroundImage: `linear-gradient(90deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha(theme.palette.background.paper, 0.82)} 55%, ${alpha(theme.palette.background.paper, 0.62)} 100%), url("${readerHeader.coverUrl}")`,
                            backgroundSize: "cover",
                            backgroundPosition: storytellerCoverObjectPosition(
                              readerHeader.coverLayout,
                              readerHeader.coverFocalPoint,
                            ),
                          })
                        : {},
                      {
                        display: { xs: "none", md: "grid" },
                        gridTemplateColumns: {
                          md: "minmax(0, 1fr)",
                          lg: "minmax(110px, .36fr) minmax(180px, .64fr)",
                          xl: "minmax(110px, .28fr) minmax(210px, .4fr) minmax(0, 1fr)",
                        },
                        alignItems: "center",
                        gap: 2,
                        flex: {
                          md: "0 1 320px",
                          lg: "0 1 500px",
                          xl: "0 1 760px",
                        },
                        minWidth: 0,
                        mx: 2,
                      },
                    ]}
                  >
                    <Typography
                      variant="overline"
                      color="primary.main"
                      noWrap
                      sx={{
                        display: { md: "none", lg: "block" },
                        letterSpacing: "0.1em",
                      }}
                    >
                      {readerHeader?.projectName}
                    </Typography>
                    <Typography variant="body2" fontWeight={800} noWrap>
                      {readerHeader?.title}
                    </Typography>
                    {readerHeader?.summary && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ display: { md: "none", xl: "block" } }}
                      >
                        {readerHeader.summary}
                      </Typography>
                    )}
                  </Box>
                )}
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ flex: "1 1 0", minWidth: 0 }}
                >
                  <Button
                    component={RouterLink}
                    to={steamloomPath("my/projects/new")}
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    sx={{
                      mr: 1,
                      whiteSpace: "nowrap",
                      display: readerHeaderVisible
                        ? { xs: "none", md: "inline-flex" }
                        : { xs: "none", sm: "inline-flex" },
                    }}
                  >
                    建立創作專案
                  </Button>
                  <IconButton
                    component={RouterLink}
                    to={steamloomPath("my/projects/new")}
                    color="primary"
                    aria-label="建立創作專案"
                    sx={{
                      mr: 1,
                      display: readerHeaderVisible
                        ? "none"
                        : { xs: "inline-flex", sm: "none" },
                    }}
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
                </Stack>
              </Toolbar>
            </AppBar>
            <Container component="main" maxWidth="xl" sx={{ flex: 1, py: 3 }}>
              <Outlet />
            </Container>
            {showFooter && (
              <Container component="footer" maxWidth="xl">
                <Divider />
                <IndependentFooter service_name={STORYTELLER_APP_NAME} />
              </Container>
            )}
          </Stack>
        </StorytellerHeaderContext.Provider>
      </StorytellerAppearanceContext.Provider>
    </ThemeProvider>
  );
}

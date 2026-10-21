import {
  AppBar,
  Avatar,
  Button,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Link as RouterLink,
  Outlet,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "@/components/auth/AuthContext.ts";
import { BilingualDisclaimer } from "@/components/common/BilingualDisclaimer.tsx";
import { FaryneLogo } from "@/components/common/FaryneLogo.tsx";
import IndependentFooter from "@/components/common/IndependentFooter.tsx";
import { LanguageMenu } from "@/components/common/LanguageMenu.tsx";
import { galgamePath } from "@/helpers/galgame.ts";

export function GalgameLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, session, loading, submitting, login, logout } = useAuth();
  const [searchType, setSearchType] = useState<"videos" | "brands">(
    params.get("tab") === "brands" ? "brands" : "videos",
  );
  const [keyword, setKeyword] = useState(params.get("keyword") ?? "");
  const navigation = [
    { title: t("galgame.layout.nav.allVideos"), href: galgamePath() },
    {
      title: t("galgame.layout.nav.recentVideos"),
      href: `${galgamePath()}?tab=recent`,
    },
    {
      title: t("galgame.layout.nav.brands"),
      href: `${galgamePath()}?tab=brands`,
    },
    {
      title: t("galgame.layout.nav.favorites"),
      href: galgamePath("favorites"),
    },
    {
      title: t("galgame.layout.nav.submitChannel"),
      href: galgamePath("submit"),
    },
    {
      title: t("galgame.layout.nav.submitVideo"),
      href: galgamePath("submit-video"),
    },
  ];
  if (session?.user.is_admin) {
    navigation.push({
      title: t("galgame.layout.nav.admin"),
      href: galgamePath("admin"),
    });
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (searchType === "brands") {
      next.set("tab", "brands");
    }
    if (keyword.trim()) {
      next.set("keyword", keyword.trim());
    }
    navigate(`${galgamePath()}?${next.toString()}`);
  };

  return (
    <Stack minHeight="100vh">
      <AppBar position="sticky" elevation={0}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1 }}>
            <Stack
              component={RouterLink}
              to={galgamePath()}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                color: "inherit",
                textDecoration: "none",
                mr: "auto",
                minWidth: 0,
                // md 以上導覽列很擠，logo 不能被壓縮
                flexShrink: { md: 0 },
              }}
            >
              <FaryneLogo width={36} alt="Galgame TV" />
              {/* md～lg 之間導覽列（尤其外語）會擠到站名，這段寬度只留 logo */}
              <Typography
                variant="h6"
                component="span"
                fontWeight={800}
                noWrap
                sx={{ display: { xs: "block", md: "none", lg: "block" } }}
              >
                Galgame TV
              </Typography>
            </Stack>

            <Stack direction="row" sx={{ display: { xs: "none", md: "flex" } }}>
              {navigation.map((item) => (
                <Button
                  key={item.title}
                  component={RouterLink}
                  to={item.href}
                  color="inherit"
                  size="small"
                  // 外語標籤較長，不折行以免撐高 AppBar
                  sx={{
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    minWidth: 0,
                    textTransform: "none",
                  }}
                >
                  {item.title}
                </Button>
              ))}
            </Stack>

            <Stack
              component="form"
              direction="row"
              onSubmit={submitSearch}
              sx={{ display: { xs: "none", sm: "flex" } }}
            >
              <Select
                value={searchType}
                onChange={(event) =>
                  setSearchType(event.target.value as "videos" | "brands")
                }
                size="small"
                sx={{
                  bgcolor: "background.paper",
                  borderRadius: "6px 0 0 6px",
                  minWidth: 84,
                }}
              >
                <MenuItem value="videos">
                  {t("galgame.layout.search.videos")}
                </MenuItem>
                <MenuItem value="brands">
                  {t("galgame.layout.search.brands")}
                </MenuItem>
              </Select>
              <TextField
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t("galgame.layout.search.placeholder")}
                size="small"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="submit"
                          edge="end"
                          size="small"
                          aria-label={t("galgame.layout.search.submit")}
                        >
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  // md～lg 讓位給導覽列
                  width: { sm: 180, md: 140, lg: 240 },
                  bgcolor: "background.paper",
                  borderRadius: "0 6px 6px 0",
                  "& fieldset": { borderLeft: 0 },
                }}
              />
            </Stack>

            <LanguageMenu />
            {!loading &&
              (user ? (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Tooltip
                    title={
                      user.displayName ??
                      user.email ??
                      t("galgame.layout.auth.signedIn")
                    }
                  >
                    <Avatar
                      src={user.photoURL ?? undefined}
                      alt={
                        user.displayName ?? t("galgame.layout.auth.userAvatar")
                      }
                      sx={{ width: 32, height: 32 }}
                    />
                  </Tooltip>
                  <Tooltip title={t("galgame.layout.auth.logout")}>
                    <IconButton
                      color="inherit"
                      onClick={() => void logout()}
                      disabled={submitting}
                    >
                      <LogoutIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                <Tooltip title={t("galgame.layout.auth.login")}>
                  <IconButton
                    color="inherit"
                    onClick={() => void login()}
                    disabled={submitting}
                  >
                    <LoginIcon />
                  </IconButton>
                </Tooltip>
              ))}
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <Outlet />
      </Container>

      <BilingualDisclaimer
        title="警語與版權宣告 / Disclaimer and Copyright Notice"
        chinese="本網站整理公開可嵌入之官方 YouTube 影片資訊，影片與商標權利均屬原權利人所有。內容可能涉及成人向遊戲或不適合未成年人之題材，請依所在地法律與平台規範自行判斷是否瀏覽。"
        english="This site indexes publicly embeddable official YouTube video metadata. Videos, trademarks, and related rights belong to their respective owners. Some content may involve adult-oriented games or themes unsuitable for minors; please follow local laws and platform rules."
      />
      <Container component="footer" maxWidth="lg">
        <Divider />
        <IndependentFooter service_name="Galgame TV" />
      </Container>
    </Stack>
  );
}

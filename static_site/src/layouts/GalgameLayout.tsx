import {
  AppBar,
  Avatar,
  Box,
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
import {
  Link as RouterLink,
  Outlet,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "@/components/auth/AuthContext.ts";
import { FaryneLogo } from "@/components/common/FaryneLogo.tsx";

const navigation = [
  { title: "全部影片", href: "/" },
  { title: "最新影片", href: "/?tab=recent" },
  { title: "品牌", href: "/?tab=brands" },
];

export function GalgameLayout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading, submitting, login, logout } = useAuth();
  const [searchType, setSearchType] = useState<"videos" | "brands">(
    params.get("tab") === "brands" ? "brands" : "videos",
  );
  const [keyword, setKeyword] = useState(params.get("keyword") ?? "");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (searchType === "brands") {
      next.set("tab", "brands");
    }
    if (keyword.trim()) {
      next.set("keyword", keyword.trim());
    }
    navigate(`/?${next.toString()}`);
  };

  return (
    <Stack minHeight="100vh">
      <AppBar position="sticky" elevation={0}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1 }}>
            <Stack
              component={RouterLink}
              to="/"
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                color: "inherit",
                textDecoration: "none",
                mr: "auto",
                minWidth: 0,
              }}
            >
              <FaryneLogo width={36} alt="Galgame TV" />
              <Typography variant="h6" component="span" fontWeight={800} noWrap>
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
                <MenuItem value="videos">影片</MenuItem>
                <MenuItem value="brands">品牌</MenuItem>
              </Select>
              <TextField
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜尋"
                size="small"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton type="submit" edge="end" size="small">
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  width: { sm: 180, lg: 240 },
                  bgcolor: "background.paper",
                  borderRadius: "0 6px 6px 0",
                  "& fieldset": { borderLeft: 0 },
                }}
              />
            </Stack>

            {!loading &&
              (user ? (
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
                      color="inherit"
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

      <Container component="footer" maxWidth="lg">
        <Divider />
        <Box sx={{ py: 2, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Galgame TV by{" "}
            <Typography
              component="a"
              href="https://faryne.dev/"
              variant="body2"
              color="inherit"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textDecoration: "underline" }}
            >
              faryne.dev
            </Typography>
          </Typography>
        </Box>
      </Container>
    </Stack>
  );
}

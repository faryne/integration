import { useAuth } from "@/components/auth/AuthContext.ts";
import IndependentFooter from "@/components/common/IndependentFooter.tsx";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  AppBar,
  Avatar,
  Button,
  Container,
  Divider,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link as RouterLink, Outlet } from "react-router-dom";

export function StorytellerLayout() {
  const { user, session, loading, submitting, login, logout } = useAuth();
  const displayName =
    session?.user.display_name ?? user?.displayName ?? user?.email ?? "使用者";
  const photoURL = session?.user.photo_url ?? user?.photoURL ?? undefined;

  return (
    <Stack sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
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
            <Button component={RouterLink} to="/storyteller" size="small">
              公開故事
            </Button>
            <Button component={RouterLink} to="/storyteller/mine" size="small">
              我的工作台
            </Button>
            <Button
              component={RouterLink}
              to="/storyteller/favorites"
              size="small"
              startIcon={<FavoriteIcon />}
            >
              我的收藏
            </Button>
          </Stack>
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
  );
}

import GoogleIcon from "@mui/icons-material/Google";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { firebaseConfigReady } from "@/lib/firebase.ts";
import { useTitle } from "@/helpers/title.tsx";
import { useAuth } from "@/components/auth/AuthContext.ts";

function authErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Google 登入失敗，請稍後再試。";
}

export default function Login() {
  useTitle("Google 登入");

  const {
    user,
    session,
    loading: authLoading,
    submitting,
    login,
    logout,
  } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);

    try {
      await login();
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    setErrorMessage(null);

    try {
      await logout();
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  };

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 180px)",
        display: "grid",
        placeItems: "center",
        px: { xs: 1, md: 4 },
        py: { xs: 4, md: 8 },
        background:
          "radial-gradient(circle at top left, rgba(25,118,210,0.18), transparent 34%), linear-gradient(135deg, #eef6ff 0%, #fff7ef 100%)",
        borderRadius: 6,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: "min(100%, 560px)",
          borderRadius: 5,
          border: "1px solid rgba(20, 40, 80, 0.1)",
          boxShadow: "0 24px 70px rgba(20, 52, 90, 0.16)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            px: { xs: 3, md: 5 },
            pt: { xs: 4, md: 5 },
            pb: 3,
            color: "#102033",
          }}
        >
          <Stack spacing={2}>
            <Chip
              label="Firebase Authentication"
              sx={{ alignSelf: "flex-start", fontWeight: 700 }}
            />
            <Typography component="h1" variant="h3" sx={{ fontWeight: 900 }}>
              使用 Google 註冊或登入
            </Typography>
            <Typography color="text.secondary">
              這個頁面只啟用 Google provider，不提供單純帳號密碼登入或註冊。
            </Typography>
          </Stack>
        </Box>

        <Divider />

        <CardContent sx={{ px: { xs: 3, md: 5 }, py: 4 }}>
          <Stack spacing={3}>
            {!firebaseConfigReady && (
              <Alert severity="warning">
                尚未設定 Firebase client config。請在環境變數加入
                VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、
                VITE_FIREBASE_PROJECT_ID、VITE_FIREBASE_APP_ID。
              </Alert>
            )}

            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            {authLoading ? (
              <Stack alignItems="center" spacing={2} py={4}>
                <CircularProgress size={30} />
                <Typography color="text.secondary">確認登入狀態中</Typography>
              </Stack>
            ) : user ? (
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={user.photoURL ?? undefined}
                    alt={user.displayName ?? "Google 使用者"}
                    sx={{ width: 64, height: 64 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {user.displayName ?? "已登入使用者"}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ wordBreak: "break-all" }}
                    >
                      {user.email}
                    </Typography>
                  </Box>
                </Stack>

                {session && (
                  <Alert severity="success">
                    後端 session 已建立，encrypt_key 有效期限：
                    {new Date(session.expires_at).toLocaleString()}
                  </Alert>
                )}

                <Button
                  size="large"
                  variant="outlined"
                  color="inherit"
                  startIcon={<LogoutIcon />}
                  disabled={submitting}
                  onClick={handleLogout}
                >
                  登出
                </Button>
              </Stack>
            ) : (
              <Button
                size="large"
                variant="contained"
                startIcon={<GoogleIcon />}
                disabled={!firebaseConfigReady || submitting}
                onClick={handleGoogleLogin}
                sx={{
                  py: 1.4,
                  borderRadius: 999,
                  fontWeight: 800,
                  textTransform: "none",
                }}
              >
                {submitting ? "連線中" : "使用 Google 繼續"}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

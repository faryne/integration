import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { joyuInk } from "@/components/joyu/joyuTheme.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { joyuFirebaseReady } from "@/lib/joyuFirebase.ts";

import { useJoyuAuth } from "./JoyuAuthContext.ts";

// 登入失敗時要提示的錯誤；使用者自己關掉彈窗不算錯
const loginErrorMessage = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? "";
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  )
    return "";
  if (code === "auth/popup-blocked")
    return "登入視窗被瀏覽器擋下了，請允許彈出視窗後再試一次";
  return "登入失敗，請稍後再試";
};

/**
 * joyu 頁首的帳號區：沒登入或匿名時有「登入」（匿名會升級成 Google 帳號，追蹤保留）；
 * 有帳號（含匿名）時多一個頭像選單：我的追蹤、登出
 */
export function JoyuAccountMenu() {
  const { user, loading, loginWithGoogle, logout } = useJoyuAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [error, setError] = useState("");
  if (!joyuFirebaseReady || loading) return null;

  const login = async () => {
    setAnchor(null);
    try {
      await loginWithGoogle();
    } catch (e) {
      setError(loginErrorMessage(e));
    }
  };
  const anonymous = !user || user.isAnonymous;

  return (
    <>
      {anonymous && (
        <Button
          onClick={() => void login()}
          size="small"
          startIcon={<GoogleIcon fontSize="small" />}
          sx={{
            border: `1px solid ${joyuInk.line}`,
            color: joyuInk.text,
            whiteSpace: "nowrap",
          }}
        >
          登入
        </Button>
      )}
      {user && (
        <IconButton
          aria-label="帳號選單"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ p: 0.25 }}
        >
          <Avatar
            src={user.photoURL ?? undefined}
            sx={{ width: 30, height: 30, bgcolor: joyuInk.line }}
          >
            <PersonOutlineIcon fontSize="small" />
          </Avatar>
        </IconButton>
      )}
      <Menu anchorEl={anchor} onClose={() => setAnchor(null)} open={!!anchor}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
            {user?.isAnonymous ? "匿名帳號" : user?.displayName}
          </Typography>
          {!user?.isAnonymous && (
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
              {user?.email}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem
          component={RouterLink}
          onClick={() => setAnchor(null)}
          to={joyuPath("me/follows")}
        >
          我的追蹤
        </MenuItem>
        {user?.isAnonymous ? (
          <MenuItem onClick={() => void login()}>用 Google 登入</MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              void logout();
            }}
          >
            登出
          </MenuItem>
        )}
      </Menu>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={!!error}
        severity="error"
      />
    </>
  );
}

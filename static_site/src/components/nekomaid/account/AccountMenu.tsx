import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import {
  useNekomaidAccount,
  useNekomaidLogout,
} from "@/apis/nekomaid/account.ts";
import { useNekomaidSession } from "@/apis/nekomaid/accountSession.ts";
import { ChangeEmailDialog } from "@/components/nekomaid/account/ChangeEmailDialog.tsx";
import { nekomaidPath } from "@/helpers/nekomaid.ts";
import {
  nekomaidAccountEnabled,
  nekomaidLoginPath,
  nekomaidMePath,
} from "@/helpers/nekomaidAccount.ts";

// 深色 header 上的外框按鈕樣式（跟「回 faryne.dev」一致）
const ghostButtonSx = {
  borderColor: "rgba(255,255,255,0.28)",
  color: "#f8fafc",
  "&:hover": {
    borderColor: "rgba(255,255,255,0.54)",
    bgcolor: "rgba(255,255,255,0.08)",
  },
};

/** 頁首右側：未登入是「登入」，登入後是頭像選單（我的追蹤、登出） */
export function AccountMenu() {
  const session = useNekomaidSession();
  const account = useNekomaidAccount();
  const logout = useNekomaidLogout();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!nekomaidAccountEnabled()) return null;

  if (!session) {
    return (
      <Button
        component={RouterLink}
        size="small"
        sx={ghostButtonSx}
        to={nekomaidLoginPath(location.pathname + location.search)}
        variant="outlined"
      >
        登入
      </Button>
    );
  }
  const name = account.data?.name ?? session.user.display_name ?? "";
  return (
    <>
      <IconButton
        aria-label="帳號選單"
        onClick={(e) => setAnchor(e.currentTarget)}
        size="small"
      >
        <Avatar
          sx={{ bgcolor: "#f59e0b", fontWeight: 900, height: 34, width: 34 }}
        >
          {name.slice(0, 1).toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        open={anchor !== null}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography color="text.secondary" variant="caption">
            {name}
          </Typography>
        </Box>
        <MenuItem
          component={RouterLink}
          onClick={() => setAnchor(null)}
          to={nekomaidMePath()}
        >
          我的追蹤
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            logout.mutate(undefined, {
              onSettled: () => navigate(nekomaidPath()),
            });
          }}
        >
          登出
        </MenuItem>
      </Menu>
    </>
  );
}

/**
 * 還沒驗證 email 時，每一頁頂端的提示條；改版前的舊帳號（還沒整合）多一個「修改 email」
 * （舊 email 可能早就收不到信）
 */
export function VerifyEmailBar() {
  const account = useNekomaidAccount();
  const [changing, setChanging] = useState(false);
  if (!nekomaidAccountEnabled() || !account.data || account.data.email_verified)
    return null;
  const { pending_email: pending, can_change_email: canChange } = account.data;
  return (
    <>
      <Alert
        action={
          canChange && (
            <Button
              color="inherit"
              onClick={() => setChanging(true)}
              size="small"
              sx={{ textTransform: "none" }}
            >
              修改 email
            </Button>
          )
        }
        severity="warning"
        sx={{ alignItems: "center", borderRadius: 0, justifyContent: "center" }}
      >
        {pending
          ? `驗證信已寄到 ${pending}，請在 24 小時內點連結，否則帳號會被刪除。`
          : "請在 24 小時內到信箱點驗證連結，否則帳號會被刪除。"}
      </Alert>
      {canChange && (
        <ChangeEmailDialog onClose={() => setChanging(false)} open={changing} />
      )}
    </>
  );
}

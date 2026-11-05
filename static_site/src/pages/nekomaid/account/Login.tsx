import { useState } from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Alert, Button, Link, Stack, TextField } from "@mui/material";

import {
  accountErrorReason,
  useNekomaidLogin,
} from "@/apis/nekomaid/account.ts";
import { AccountPageShell } from "@/components/nekomaid/account/AccountPageShell.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import {
  nekomaidForgotPasswordPath,
  nekomaidRegisterPath,
  safeRedirect,
} from "@/helpers/nekomaidAccount.ts";

// 這幾種原因要在表單裡顯示提示（並補欄位），其他錯誤用 SNACK
const INLINE_REASONS = ["need_password", "need_email", "merged"];

/**
 * 登入：單一表單「帳號或 Email＋密碼」，後端判斷。舊會員第一次登入時順便搬進 Firebase，
 * 遇到舊密碼太短／舊 email 不能用時，表單會多出新密碼或新 email 欄位再送一次
 */
export default function NekomaidLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [notice, setNotice] = useState<{
    reason: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const mutation = useNekomaidLogin();
  const needPassword = notice?.reason === "need_password";
  const needEmail = notice?.reason === "need_email";
  const passwordMismatch = needPassword && newPassword !== newPasswordConfirm;

  const submit = () =>
    mutation.mutate(
      {
        login: login.trim(),
        password,
        new_password: needPassword ? newPassword : undefined,
        new_email: needEmail ? newEmail.trim() : undefined,
      },
      {
        onSuccess: () =>
          navigate(safeRedirect(params.get("redirect")), { replace: true }),
        onError: (e) => {
          const reason = accountErrorReason(e);
          const message = apiErrorMessage(e, "登入失敗，請稍後再試");
          if (INLINE_REASONS.includes(reason)) setNotice({ reason, message });
          else setError(message);
        },
      },
    );

  return (
    <AccountPageShell title="登入">
      <Stack
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        spacing={2}
      >
        <TextField
          autoComplete="username"
          label="帳號或 Email"
          onChange={(e) => setLogin(e.target.value)}
          size="small"
          value={login}
        />
        <TextField
          autoComplete="current-password"
          label="密碼"
          onChange={(e) => setPassword(e.target.value)}
          size="small"
          type="password"
          value={password}
        />
        {notice && (
          <Alert severity={notice.reason === "merged" ? "info" : "warning"}>
            {notice.message}
          </Alert>
        )}
        {needPassword && (
          <>
            <TextField
              autoComplete="new-password"
              label="新密碼"
              onChange={(e) => setNewPassword(e.target.value)}
              size="small"
              type="password"
              value={newPassword}
            />
            <TextField
              autoComplete="new-password"
              error={passwordMismatch && newPasswordConfirm !== ""}
              label="再輸入一次新密碼"
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              size="small"
              type="password"
              value={newPasswordConfirm}
            />
          </>
        )}
        {needEmail && (
          <TextField
            autoComplete="email"
            label="新 email"
            onChange={(e) => setNewEmail(e.target.value)}
            size="small"
            type="email"
            value={newEmail}
          />
        )}
        <Button
          disabled={
            mutation.isPending ||
            !login.trim() ||
            !password ||
            (needPassword && (!newPassword || passwordMismatch)) ||
            (needEmail && !newEmail.trim())
          }
          size="large"
          type="submit"
          variant="contained"
        >
          登入
        </Button>
        <Stack direction="row" justifyContent="space-between">
          <Link component={RouterLink} to={nekomaidRegisterPath()}>
            註冊新帳號
          </Link>
          <Link component={RouterLink} to={nekomaidForgotPasswordPath()}>
            忘記密碼
          </Link>
        </Stack>
      </Stack>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
    </AccountPageShell>
  );
}

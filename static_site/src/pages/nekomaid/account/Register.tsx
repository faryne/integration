import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Alert, Button, Link, Stack, TextField } from "@mui/material";

import {
  accountErrorReason,
  useNekomaidRegister,
} from "@/apis/nekomaid/account.ts";
import { AccountPageShell } from "@/components/nekomaid/account/AccountPageShell.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { nekomaidPath } from "@/helpers/nekomaid.ts";
import {
  nekomaidForgotPasswordPath,
  nekomaidLoginPath,
} from "@/helpers/nekomaidAccount.ts";

/** 註冊：email＋兩次密碼；email 是舊會員的就請他用舊密碼登入或重設密碼，不另外建帳號 */
export default function NekomaidRegister() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [legacy, setLegacy] = useState("");
  const [error, setError] = useState("");
  const mutation = useNekomaidRegister();
  const mismatch = confirm !== "" && password !== confirm;

  const submit = () =>
    mutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate(nekomaidPath(), { replace: true }),
        onError: (e) => {
          const message = apiErrorMessage(e, "註冊失敗，請稍後再試");
          if (accountErrorReason(e) === "legacy_email") setLegacy(message);
          else setError(message);
        },
      },
    );

  return (
    <AccountPageShell title="註冊">
      <Stack
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        spacing={2}
      >
        <TextField
          autoComplete="email"
          label="Email"
          onChange={(e) => {
            setEmail(e.target.value);
            setLegacy("");
          }}
          size="small"
          type="email"
          value={email}
        />
        {legacy && (
          <Alert severity="info">
            {legacy}（
            <Link component={RouterLink} to={nekomaidLoginPath()}>
              登入
            </Link>
            ／
            <Link component={RouterLink} to={nekomaidForgotPasswordPath()}>
              重設密碼
            </Link>
            ）
          </Alert>
        )}
        <TextField
          autoComplete="new-password"
          label="密碼"
          onChange={(e) => setPassword(e.target.value)}
          size="small"
          type="password"
          value={password}
        />
        <TextField
          autoComplete="new-password"
          error={mismatch}
          label="再輸入一次密碼"
          onChange={(e) => setConfirm(e.target.value)}
          size="small"
          type="password"
          value={confirm}
        />
        <Button
          disabled={
            mutation.isPending ||
            !email.trim() ||
            !password ||
            password !== confirm
          }
          size="large"
          type="submit"
          variant="contained"
        >
          註冊
        </Button>
        <Link component={RouterLink} to={nekomaidLoginPath()}>
          已經有帳號？登入
        </Link>
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

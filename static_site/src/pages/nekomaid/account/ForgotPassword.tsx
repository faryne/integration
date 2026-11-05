import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, Link, Stack, TextField } from "@mui/material";

import { useNekomaidPasswordReset } from "@/apis/nekomaid/account.ts";
import { AccountPageShell } from "@/components/nekomaid/account/AccountPageShell.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { nekomaidLoginPath } from "@/helpers/nekomaidAccount.ts";

/** 忘記密碼：送出後一律顯示同一句話，不透露 email 有沒有註冊 */
export default function NekomaidForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const mutation = useNekomaidPasswordReset();

  return (
    <AccountPageShell title="忘記密碼">
      {mutation.isSuccess ? (
        <Alert severity="success">
          如果這個 email 有註冊，重設密碼信已寄出。
        </Alert>
      ) : (
        <Stack
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(email.trim(), {
              onError: (err) =>
                setError(apiErrorMessage(err, "送出失敗，請稍後再試")),
            });
          }}
          spacing={2}
        >
          <TextField
            autoComplete="email"
            label="Email"
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            type="email"
            value={email}
          />
          <Button
            disabled={mutation.isPending || !email.trim()}
            size="large"
            type="submit"
            variant="contained"
          >
            寄送重設密碼信
          </Button>
        </Stack>
      )}
      <Link component={RouterLink} to={nekomaidLoginPath()}>
        回到登入
      </Link>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
    </AccountPageShell>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  TextField,
} from "@mui/material";

import {
  accountErrorReason,
  useNekomaidAuthAction,
} from "@/apis/nekomaid/account.ts";
import { AccountPageShell } from "@/components/nekomaid/account/AccountPageShell.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { nekomaidPath } from "@/helpers/nekomaid.ts";
import {
  nekomaidLoginPath,
  nekomaidMePath,
} from "@/helpers/nekomaidAccount.ts";

/**
 * 信件連結（Firebase 動作網址設成 /auth/action）：?mode=verifyEmail|resetPassword&oobCode=…
 * 驗證 email 一進頁面就送出；重設密碼先填新密碼。兩者成功時後端都會合併同 email 的舊帳號
 */
export default function NekomaidAuthAction() {
  const [params] = useSearchParams();
  const mode = params.get("mode") ?? "";
  const oobCode = params.get("oobCode") ?? "";
  const isReset = mode === "resetPassword";
  const action = useNekomaidAuthAction();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const verifySent = useRef(false);
  const linkInvalid =
    !oobCode ||
    !["verifyEmail", "resetPassword"].includes(mode) ||
    (action.isError && accountErrorReason(action.error) === "link_invalid");

  // 驗證 email：進頁面就送一次（StrictMode 下也只送一次）
  useEffect(() => {
    if (mode !== "verifyEmail" || !oobCode || verifySent.current) return;
    verifySent.current = true;
    action.mutate({ mode, oob_code: oobCode });
  }, [mode, oobCode, action]);

  const merged = action.data?.merged ?? [];

  return (
    <AccountPageShell title={isReset ? "重設密碼" : "Email 驗證"}>
      {linkInvalid ? (
        <>
          <Alert severity="warning">
            這個連結已經用過或過期，請重新登入，系統會再寄一封新的信。
          </Alert>
          <Button
            component={RouterLink}
            to={nekomaidLoginPath()}
            variant="contained"
          >
            登入
          </Button>
        </>
      ) : action.isSuccess ? (
        <>
          <Alert severity="success">
            {isReset ? "密碼已重設，請用新密碼登入。" : "已完成驗證。"}
            {merged.length > 0 &&
              `同一個 email 的 ${merged.length} 個舊帳號（${merged.join("、")}）的追蹤已併進來。`}
          </Alert>
          <Button
            component={RouterLink}
            to={
              isReset
                ? nekomaidLoginPath()
                : merged.length > 0
                  ? nekomaidMePath()
                  : nekomaidPath()
            }
            variant="contained"
          >
            {isReset ? "登入" : merged.length > 0 ? "查看我的追蹤" : "回到首頁"}
          </Button>
        </>
      ) : isReset ? (
        <Stack
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            action.mutate(
              { mode, oob_code: oobCode, new_password: password },
              {
                onError: (err) =>
                  setError(apiErrorMessage(err, "重設失敗，請稍後再試")),
              },
            );
          }}
          spacing={2}
        >
          <TextField
            autoComplete="new-password"
            label="新密碼"
            onChange={(e) => setPassword(e.target.value)}
            size="small"
            type="password"
            value={password}
          />
          <TextField
            autoComplete="new-password"
            error={confirm !== "" && confirm !== password}
            label="再輸入一次新密碼"
            onChange={(e) => setConfirm(e.target.value)}
            size="small"
            type="password"
            value={confirm}
          />
          <Button
            disabled={action.isPending || !password || password !== confirm}
            size="large"
            type="submit"
            variant="contained"
          >
            重設密碼
          </Button>
        </Stack>
      ) : action.isError ? (
        <Alert severity="error">
          {apiErrorMessage(action.error, "驗證失敗，請稍後再試")}
        </Alert>
      ) : (
        <CircularProgress sx={{ alignSelf: "center" }} />
      )}
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
    </AccountPageShell>
  );
}

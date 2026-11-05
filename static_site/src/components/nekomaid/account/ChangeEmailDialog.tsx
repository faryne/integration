import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";

import { useNekomaidChangeEmail } from "@/apis/nekomaid/account.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";

/**
 * 改版前的舊帳號在整合（email 驗證）前修改 email：輸入新 email 與目前密碼，
 * 驗證信寄到新信箱、點了才真的換；驗證完成就整合帳號，之後不能再改
 */
export function ChangeEmailDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const mutation = useNekomaidChangeEmail();

  return (
    <>
      <Dialog
        fullWidth
        maxWidth="xs"
        onClose={onClose}
        open={open}
        // 關閉動畫結束後清空，下次開啟是新的表單
        slotProps={{
          transition: {
            onExited: () => {
              setEmail("");
              setPassword("");
            },
          },
        }}
      >
        <DialogTitle>修改 email</DialogTitle>
        <DialogContent>
          <Stack
            component="form"
            id="change-email-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(
                { email: email.trim(), password },
                {
                  onSuccess: () => {
                    setSent(true);
                    onClose();
                  },
                  onError: (err) =>
                    setError(apiErrorMessage(err, "修改失敗，請稍後再試")),
                },
              );
            }}
            spacing={2}
            sx={{ pt: 1 }}
          >
            <TextField
              autoComplete="email"
              label="新 email"
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              type="email"
              value={email}
            />
            <TextField
              autoComplete="current-password"
              label="目前的密碼"
              onChange={(e) => setPassword(e.target.value)}
              size="small"
              type="password"
              value={password}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button
            disabled={mutation.isPending || !email.trim() || !password}
            form="change-email-form"
            type="submit"
            variant="contained"
          >
            寄驗證信到新信箱
          </Button>
        </DialogActions>
      </Dialog>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
      <CustomSnackbar
        message="驗證信已寄到新信箱"
        onClose={() => setSent(false)}
        open={sent}
      />
    </>
  );
}

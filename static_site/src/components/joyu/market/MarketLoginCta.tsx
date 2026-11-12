import { useState } from "react";
import { Button, Paper, Typography } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { loginErrorMessage } from "@/components/joyu/auth/loginError.ts";

/**
 * 股市只限 Google 帳號：沒登入或匿名時，交易面板、資產卡、我的持股頁都換成這張。
 * 匿名帳號按了會升級成 Google 帳號（uid 不變，追蹤與片單保留）
 */
export function MarketLoginCta({
  title,
  label = "用 Google 登入",
}: {
  title: string;
  label?: string;
}) {
  const { loginWithGoogle } = useJoyuAuth();
  const [error, setError] = useState("");
  return (
    <Paper sx={{ p: 2, textAlign: "center" }} variant="outlined">
      <Typography
        component="h2"
        sx={{ fontSize: 17, fontWeight: 800, mb: 1.5 }}
      >
        {title}
      </Typography>
      <Button
        onClick={() =>
          loginWithGoogle().catch((e) => setError(loginErrorMessage(e)))
        }
        startIcon={<GoogleIcon />}
        sx={{ textTransform: "none" }}
        variant="contained"
      >
        {label}
      </Button>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={!!error}
        severity="error"
      />
    </Paper>
  );
}

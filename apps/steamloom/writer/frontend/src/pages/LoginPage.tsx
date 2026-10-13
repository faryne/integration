import { SteamLoomMark } from "@steamloom-web/components/storyteller/SteamLoomMark.tsx";
import { Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isLoginCanceled } from "@writer/lib/backend.ts";

// 未登入的主頁：按下登入後由 Go 端開系統瀏覽器走 OAuth，這裡只顯示等待中＋取消。
// 授權完成後交給外層 onLoggedIn 載入作者資料（跟啟動時同一套流程）。
export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [waiting, setWaiting] = useState(false);

  const login = async () => {
    setWaiting(true);
    try {
      await backend.Login();
      onLoggedIn();
    } catch (err) {
      // 使用者自己取消（app 按取消或授權頁按拒絕）不算錯誤
      if (!isLoginCanceled(err)) showError(errorMessage(err));
    } finally {
      setWaiting(false);
    }
  };

  return (
    <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
      <Paper variant="outlined" sx={{ width: 360, px: 4, py: 5, textAlign: "center", borderRadius: 3 }}>
        <SteamLoomMark size={56} />
        <Typography variant="h4" sx={{ fontSize: 26, mt: 1.5, mb: 3.5 }}>
          {t("app.name")}
        </Typography>
        {waiting ? (
          <>
            <CircularProgress size={24} sx={{ mb: 1.5 }} />
            <Typography color="text.secondary" sx={{ mb: 2.5 }}>
              {t("auth.waiting")}
            </Typography>
            <Button variant="outlined" onClick={() => backend.CancelLogin()}>
              {t("auth.cancel")}
            </Button>
          </>
        ) : (
          <Button variant="contained" fullWidth size="large" onClick={login}>
            {t("auth.login")}
          </Button>
        )}
      </Paper>
    </Box>
  );
}

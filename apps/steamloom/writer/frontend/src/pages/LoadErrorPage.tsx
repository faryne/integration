import { Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

// 已有登入憑證、但載入作者資料失敗（離線、站台錯誤）時顯示；不能當成沒登入丟回登入頁。
export function LoadErrorPage({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
      <Stack alignItems="center" spacing={2.5}>
        <Typography color="text.secondary">{t("auth.loadFailed")}</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onLogout}>
            {t("app.account.logout")}
          </Button>
          <Button variant="contained" onClick={onRetry}>
            {t("auth.retry")}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

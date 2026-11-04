import { Link } from "react-router-dom";
import { Button, Stack, Typography } from "@mui/material";

import { BACKEND_ADMIN_PATH } from "@/helpers/backendAdmin.ts";

/** 後台內找不到的子路徑：保留側欄，給一個回總覽的按鈕 */
export function BackendAdminNotFound() {
  return (
    <Stack alignItems="flex-start" spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        找不到頁面
      </Typography>
      <Button component={Link} to={BACKEND_ADMIN_PATH} variant="outlined">
        回到總覽
      </Button>
    </Stack>
  );
}

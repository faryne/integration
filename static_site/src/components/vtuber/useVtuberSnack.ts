import type { AlertColor } from "@mui/material";
import { useCallback, useState } from "react";

import { apiErrorMessage } from "@/helpers/apiError.ts";

interface SnackState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

/** VTuber 頁共用的 snack 狀態：API 錯誤、複製 ICS 網址的結果 */
export function useVtuberSnack() {
  const [snack, setSnack] = useState<SnackState>({
    open: false,
    message: "",
    severity: "success",
  });
  const showError = useCallback(
    (error: unknown) =>
      setSnack({
        open: true,
        severity: "error",
        message: apiErrorMessage(error, "資料載入失敗，請稍後再試"),
      }),
    [],
  );
  const showCopied = useCallback(
    (ok: boolean) =>
      setSnack(
        ok
          ? { open: true, severity: "success", message: "已複製 ICS 網址" }
          : { open: true, severity: "error", message: "複製失敗，請手動複製" },
      ),
    [],
  );
  const close = useCallback(() => setSnack((s) => ({ ...s, open: false })), []);
  return { snack, showError, showCopied, close };
}

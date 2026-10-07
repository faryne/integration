import { Alert, Portal, Snackbar } from "@mui/material";
import type { AlertColor } from "@mui/material";
import type { ReactNode } from "react";

interface CustomSnackbarProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
  // 額外的操作按鈕（例如「從頭開始」）；有給時會取代 Alert 預設的關閉按鈕
  action?: ReactNode;
  onClose: () => void;
}

export function CustomSnackbar({
  open,
  message,
  severity = "success",
  autoHideDuration,
  action,
  onClose,
}: CustomSnackbarProps) {
  // Snackbar 本身不會 portal；放在有 stacking context 的頁面內會被 Dialog backdrop 蓋住。
  return (
    <Portal>
      <Snackbar
        open={open}
        autoHideDuration={
          autoHideDuration ?? (severity === "error" ? 6000 : 2500)
        }
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={severity}
          variant="filled"
          onClose={onClose}
          action={action}
          sx={{ width: "100%" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Portal>
  );
}

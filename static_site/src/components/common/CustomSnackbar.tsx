import { Alert, Snackbar } from "@mui/material";
import type { AlertColor } from "@mui/material";

interface CustomSnackbarProps {
  open: boolean;
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
  onClose: () => void;
}

export function CustomSnackbar({
  open,
  message,
  severity = "success",
  autoHideDuration = 2500,
  onClose,
}: CustomSnackbarProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert
        severity={severity}
        variant="filled"
        onClose={onClose}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}

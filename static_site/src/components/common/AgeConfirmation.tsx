import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useId, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  setAgeConfirmed,
  useAgeConfirmed,
} from "@/helpers/ageConfirmation.ts";

export function AgeConfirmationPanel({
  description = "請先確認你已年滿 18 歲，確認後才會顯示完整內容。",
  onConfirm,
  title = "這個頁面包含成人內容",
}: {
  description?: ReactNode;
  onConfirm: () => void;
  title?: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        alignItems: "center",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        minHeight: 260,
        p: 4,
        textAlign: "center",
      }}
    >
      <Typography fontWeight={950} variant="h5">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 520 }}>
        {description}
      </Typography>
      <Button
        color="error"
        onClick={onConfirm}
        sx={{ mt: 2 }}
        variant="contained"
      >
        我已滿 18 歲，顯示內容
      </Button>
    </Paper>
  );
}

export function AgeConfirmationDialog({
  description = "請確認你已年滿 18 歲，並同意繼續瀏覽成人內容。",
  leaveTo = "/",
  onConfirm,
  open,
  title = "年齡確認",
}: {
  description?: ReactNode;
  leaveTo?: string;
  onConfirm: () => void;
  open: boolean;
  title?: ReactNode;
}) {
  const titleId = useId();

  return (
    <Dialog open={open} onClose={() => undefined} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <Typography>{description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button component={RouterLink} to={leaveTo}>
          離開
        </Button>
        <Button color="error" onClick={onConfirm} variant="contained">
          我已滿 18 歲
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AgeConfirmationGate({
  children,
  description,
  leaveTo,
  panelTitle,
}: {
  children: ReactNode;
  description?: ReactNode;
  leaveTo?: string;
  panelTitle?: ReactNode;
}) {
  const confirmed = useAgeConfirmed();
  const confirm = () => setAgeConfirmed();

  if (confirmed) {
    return <>{children}</>;
  }

  return (
    <Stack spacing={3}>
      <AgeConfirmationPanel
        description={description}
        onConfirm={confirm}
        title={panelTitle}
      />
      <AgeConfirmationDialog
        description={description}
        leaveTo={leaveTo}
        onConfirm={confirm}
        open
      />
    </Stack>
  );
}

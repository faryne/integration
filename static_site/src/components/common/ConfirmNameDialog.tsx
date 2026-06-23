import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

export interface ConfirmNameDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmName: string;
  confirmLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmNameDialog(props: ConfirmNameDialogProps) {
  const [value, setValue] = useState("");
  const matched = value === props.confirmName;

  useEffect(() => {
    if (!props.open) {
      setValue("");
    }
  }, [props.open]);

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary">{props.description}</Typography>
          <TextField
            autoFocus
            fullWidth
            label="確認名稱"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            helperText={`請輸入「${props.confirmName}」以啟用確認按鈕。`}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>取消</Button>
        <Button
          color="error"
          variant="contained"
          disabled={!matched || props.loading}
          onClick={props.onConfirm}
        >
          {props.loading ? "處理中" : props.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

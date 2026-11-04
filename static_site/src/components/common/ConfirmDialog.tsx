import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** 刪除這類不可逆操作前的確認框；文字由呼叫端帶入（多語系頁面傳 t() 的結果） */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{props.message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>{props.cancelLabel}</Button>
        <Button
          color="error"
          disabled={props.loading}
          onClick={props.onConfirm}
          variant="contained"
        >
          {props.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

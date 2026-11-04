import { useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";

/** 否決：常用原因快選＋可自由填寫（選填）；女優上稿、影片修改共用 */
export function RejectDialog({
  open,
  reasons,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  /** 常用原因（點了直接填入） */
  reasons: string[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>否決這張提交單？</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {reasons.map((r) => (
              <Chip
                clickable
                color={note === r ? "primary" : "default"}
                key={r}
                label={r}
                onClick={() => setNote(r)}
                size="small"
              />
            ))}
          </Stack>
          <TextField
            label="否決原因（選填）"
            minRows={3}
            multiline
            onChange={(e) => setNote(e.target.value)}
            value={note}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          color="error"
          disabled={loading}
          onClick={() => onConfirm(note)}
          startIcon={
            loading ? <CircularProgress color="inherit" size={16} /> : undefined
          }
          variant="contained"
        >
          否決
        </Button>
      </DialogActions>
    </Dialog>
  );
}

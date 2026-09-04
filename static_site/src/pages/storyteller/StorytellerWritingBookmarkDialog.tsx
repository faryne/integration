import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

interface StorytellerWritingBookmarkDialogProps {
  open: boolean;
  snippet: string;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

// 加入書籤時可選填筆記；沒填也只是標記這個位置。
export function StorytellerWritingBookmarkDialog({
  open,
  snippet,
  note,
  onNoteChange,
  onClose,
  onConfirm,
}: StorytellerWritingBookmarkDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>加入書籤</DialogTitle>
      <DialogContent>
        {snippet && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            這則書籤會掛在這段：「{snippet}」
          </Typography>
        )}
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          label="筆記（可留空）"
          placeholder="例如：寫到這、這裡之後要改"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={onConfirm}>
          加入書籤
        </Button>
      </DialogActions>
    </Dialog>
  );
}

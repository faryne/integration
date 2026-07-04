import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useSaveStorytellerUserProfile } from "@/apis/storyteller";

interface PenNameDialogProps {
  open: boolean;
}

export function PenNameDialog({ open }: PenNameDialogProps) {
  const [penName, setPenName] = useState("");
  const { mutate: saveProfile, isPending } = useSaveStorytellerUserProfile();

  const handleSubmit = () => {
    if (!penName.trim()) return;
    saveProfile({
      pen_name: penName.trim(),
      bio: "",
      use_default_avatar: true,
      avatar_url: "",
      sns_links: {},
      hide_favorite_projects: false,
      hide_favorite_authors: false,
    });
  };

  return (
    <Dialog open={open} disableEscapeKeyDown>
      <DialogTitle>設定筆名</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          歡迎使用 Storyteller！在開始創作之前，請先設定您的筆名。
        </DialogContentText>
        <TextField
          autoFocus
          required
          margin="dense"
          label="筆名"
          fullWidth
          variant="outlined"
          value={penName}
          onChange={(e) => setPenName(e.target.value)}
          disabled={isPending}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!penName.trim() || isPending}
        >
          確定
        </Button>
      </DialogActions>
    </Dialog>
  );
}

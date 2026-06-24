import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useAuth } from "./AuthContext";

interface LoginPromptDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function LoginPromptDialog({
  open,
  onClose,
  title = "需要登入",
  description = "此功能需要登入後才能使用。是否要現在登入？",
}: LoginPromptDialogProps) {
  const { login } = useAuth();

  const handleLogin = () => {
    onClose();
    void login();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleLogin} variant="contained" autoFocus>
          登入
        </Button>
      </DialogActions>
    </Dialog>
  );
}

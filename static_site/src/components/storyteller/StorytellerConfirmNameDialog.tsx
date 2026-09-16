import { Button, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { StorytellerMascotDialog } from "./StorytellerMascotDialog.tsx";

export interface StorytellerConfirmNameDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmName: string;
  confirmLabel: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Storyteller 的不可逆名稱確認，保留共用 ConfirmNameDialog 的安全門檻。 */
export function StorytellerConfirmNameDialog({
  open,
  title,
  description,
  confirmName,
  confirmLabel,
  loading,
  onClose,
  onConfirm,
}: StorytellerConfirmNameDialogProps) {
  const [value, setValue] = useState("");
  const matched = value === confirmName;

  useEffect(() => {
    setValue("");
  }, [open, confirmName]);

  return (
    <StorytellerMascotDialog
      open={open}
      state="danger"
      eyebrow={title}
      title={`確定要${title}「${confirmName}」？`}
      description={description}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>先不要</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!matched || loading}
            onClick={onConfirm}
          >
            {loading ? "處理中" : confirmLabel}
          </Button>
        </>
      }
    >
      <TextField
        autoFocus
        fullWidth
        label="輸入名稱以繼續"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        helperText={`請輸入「${confirmName}」以啟用確認按鈕。`}
      />
    </StorytellerMascotDialog>
  );
}

import { Alert, Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerMascotDialog } from "./StorytellerMascotDialog.tsx";

export interface StorytellerConfirmNameDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmName: string;
  confirmLabel: string;
  loading?: boolean;
  error?: string;
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
  error,
  onClose,
  onConfirm,
}: StorytellerConfirmNameDialogProps) {
  const { t } = useTranslation();
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
      title={t("writer.confirmName.title", { action: title, name: confirmName })}
      description={description}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t("writer.confirmName.cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!matched || loading}
            onClick={onConfirm}
          >
            {loading ? t("writer.common.processing") : confirmLabel}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          autoFocus
          fullWidth
          label={t("writer.confirmName.input")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          helperText={t("writer.confirmName.helper", { name: confirmName })}
        />
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </StorytellerMascotDialog>
  );
}

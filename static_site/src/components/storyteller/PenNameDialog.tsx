import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";

interface PenNameDialogProps {
  open: boolean;
  /** 筆名存檔成功後呼叫——目前給 StorytellerLayout 接著彈出新手功能導覽用，
   * 只有「這次真的存成功」才算完成第一次設定，不是每次 open/close 都算。 */
  onCompleted?: () => void;
}

export function PenNameDialog({ open, onCompleted }: PenNameDialogProps) {
  const { t } = useTranslation();
  const [penName, setPenName] = useState("");
  const { mutate: saveProfile, isPending } = useSaveStorytellerUserProfile();

  const handleSubmit = () => {
    if (!penName.trim()) return;
    saveProfile(
      {
        pen_name: penName.trim(),
        bio: "",
        use_default_avatar: true,
        avatar_url: "",
        sns_links: {},
        hide_favorite_projects: false,
        hide_favorite_authors: false,
        auto_save_enabled: true,
        auto_save_interval_minutes: 5,
      },
      { onSuccess: () => onCompleted?.() },
    );
  };

  return (
    <Dialog open={open} disableEscapeKeyDown>
      <DialogTitle>{t("web.onboarding.penNameTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t("web.onboarding.penNameWelcome", { appName: STORYTELLER_APP_NAME })}
        </DialogContentText>
        <TextField
          autoFocus
          required
          margin="dense"
          label={t("web.onboarding.penName")}
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
          {t("web.common.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

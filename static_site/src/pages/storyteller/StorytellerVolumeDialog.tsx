import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  workspaceDialogActionsSx,
  workspaceDialogBackdropSx,
  workspaceDialogContentSx,
  workspaceDialogPaperSx,
  workspaceDialogTitleSx,
  workspaceTextFieldSx,
} from "./ProjectWorkspacePreviewDialogStyles.ts";

export interface StorytellerVolumeDialogProps {
  open: boolean;
  // 有值代表重新命名，空值代表新增一冊。
  initialTitle?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

// 冊只有標題可以編輯，刻意不共用 StoryEditor.tsx——冊沒有內容／摘要／狀態，
// 沒有 AI Agent 面板／字數統計的需求，用一個輕量對話框處理就好。冊本身是通用容器，
// 文字故事跟話（圖像作品）可以混著放在同一冊裡，不需要選類型。
export function StorytellerVolumeDialog(props: StorytellerVolumeDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(props.initialTitle ?? "");
  const isEditing = Boolean(props.initialTitle);

  useEffect(() => {
    if (props.open) {
      setTitle(props.initialTitle ?? "");
    }
  }, [props.open, props.initialTitle]);

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: { sx: workspaceDialogPaperSx },
        backdrop: { sx: workspaceDialogBackdropSx },
      }}
    >
      <DialogTitle sx={workspaceDialogTitleSx}>
        {isEditing
          ? t("web.workspacePreview.actions.renameVolume")
          : t("web.projectWorkspace.volume.add")}
      </DialogTitle>
      <DialogContent sx={workspaceDialogContentSx}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label={t("web.projectWorkspace.volume.name")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("web.projectWorkspace.volume.namePlaceholder")}
            sx={workspaceTextFieldSx}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={workspaceDialogActionsSx}>
        <Button onClick={props.onClose}>{t("web.common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={!title.trim() || props.loading}
          onClick={() => props.onSubmit(title.trim())}
        >
          {props.loading
            ? t("web.assetManager.saving")
            : isEditing
              ? t("web.common.save")
              : t("web.common.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

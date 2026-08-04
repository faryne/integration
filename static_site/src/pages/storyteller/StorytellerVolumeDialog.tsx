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
        {isEditing ? "重新命名冊" : "新增冊"}
      </DialogTitle>
      <DialogContent sx={workspaceDialogContentSx}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="冊名稱"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：第一冊"
            sx={workspaceTextFieldSx}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={workspaceDialogActionsSx}>
        <Button onClick={props.onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={!title.trim() || props.loading}
          onClick={() => props.onSubmit(title.trim())}
        >
          {props.loading ? "儲存中" : isEditing ? "儲存" : "新增"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

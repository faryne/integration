import { Button } from "@mui/material";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";

// 工作台內所有離開編輯器的入口共用同一份警告與操作文案，避免各入口日後分岔。
export function StorytellerUnsavedChangesDialog({
  open,
  onContinueEditing,
  onDiscardChanges,
}: {
  open: boolean;
  onContinueEditing: () => void;
  onDiscardChanges: () => void;
}) {
  return (
    <StorytellerMascotDialog
      open={open}
      state="danger"
      toneLabel="變更尚未儲存"
      eyebrow="離開編輯器"
      title="你有尚未儲存的變更"
      description="離開這個編輯畫面後，還沒存檔的變更會遺失。確定要放棄變更並離開嗎？"
      onClose={onContinueEditing}
      actions={
        <>
          <Button onClick={onContinueEditing}>繼續編輯</Button>
          <Button color="error" variant="contained" onClick={onDiscardChanges}>
            放棄變更並離開
          </Button>
        </>
      }
    />
  );
}

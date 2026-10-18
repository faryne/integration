import { Button, CircularProgress } from "@mui/material";
import { useState } from "react";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";

// 工作台內所有離開編輯器的入口共用同一份警告與操作文案，避免各入口日後分岔；網站與 SteamLoom Writer 共用。
// onSaveAndContinue（編輯器有登記存檔函式時才傳）：先存檔再繼續；存檔失敗或版本衝突由呼叫端關掉對話框、留在編輯頁。
export function StorytellerUnsavedChangesDialog({
  open,
  onContinueEditing,
  onDiscardChanges,
  onSaveAndContinue,
}: {
  open: boolean;
  onContinueEditing: () => void;
  onDiscardChanges: () => void;
  onSaveAndContinue?: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const saveAndContinue = async () => {
    if (!onSaveAndContinue) return;
    setSaving(true);
    try {
      await onSaveAndContinue();
    } finally {
      setSaving(false);
    }
  };
  return (
    <StorytellerMascotDialog
      open={open}
      state="danger"
      toneLabel="變更尚未儲存"
      eyebrow="離開編輯器"
      title="你有尚未儲存的變更"
      description={
        onSaveAndContinue
          ? "離開這個編輯畫面前要先存檔嗎？不存檔的話，變更會遺失。"
          : "離開這個編輯畫面後，還沒存檔的變更會遺失。確定要放棄變更並離開嗎？"
      }
      onClose={() => !saving && onContinueEditing()}
      actions={
        <>
          <Button disabled={saving} onClick={onContinueEditing}>
            繼續編輯
          </Button>
          <Button
            color="error"
            variant={onSaveAndContinue ? "text" : "contained"}
            disabled={saving}
            onClick={onDiscardChanges}
          >
            放棄變更並離開
          </Button>
          {onSaveAndContinue && (
            <Button
              variant="contained"
              disabled={saving}
              onClick={() => void saveAndContinue()}
            >
              {saving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                "存檔並繼續"
              )}
            </Button>
          )}
        </>
      }
    />
  );
}

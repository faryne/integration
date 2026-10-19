import { Button, CircularProgress } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";

export interface StorytellerUnsavedChangesDialogLabels {
  toneLabel: string;
  eyebrow: string;
  title: string;
  saveDescription: string;
  discardDescription: string;
  continueEditing: string;
  discardAndLeave: string;
  saveAndContinue: string;
}

// 工作台內所有離開編輯器的入口共用同一份警告與操作文案，避免各入口日後分岔；網站與 SteamLoom Writer 共用。
// onSaveAndContinue（編輯器有登記存檔函式時才傳）：先存檔再繼續；存檔失敗或版本衝突由呼叫端關掉對話框、留在編輯頁。
export function StorytellerUnsavedChangesDialog({
  open,
  onContinueEditing,
  onDiscardChanges,
  onSaveAndContinue,
  labels,
}: {
  open: boolean;
  onContinueEditing: () => void;
  onDiscardChanges: () => void;
  onSaveAndContinue?: () => Promise<void>;
  labels?: StorytellerUnsavedChangesDialogLabels;
}) {
  const { t } = useTranslation();
  const effectiveLabels: StorytellerUnsavedChangesDialogLabels =
    labels ?? {
      toneLabel: t("writer:unsaved.toneLabel"),
      eyebrow: t("writer:unsaved.eyebrow"),
      title: t("writer:unsaved.title"),
      saveDescription: t("writer:unsaved.saveDescription"),
      discardDescription: t("writer:unsaved.discardDescription"),
      continueEditing: t("writer:unsaved.continueEditing"),
      discardAndLeave: t("writer:unsaved.discardAndLeave"),
      saveAndContinue: t("writer:unsaved.saveAndContinue"),
    };
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
      toneLabel={effectiveLabels.toneLabel}
      eyebrow={effectiveLabels.eyebrow}
      title={effectiveLabels.title}
      description={
        onSaveAndContinue
          ? effectiveLabels.saveDescription
          : effectiveLabels.discardDescription
      }
      onClose={() => !saving && onContinueEditing()}
      actions={
        <>
          <Button disabled={saving} onClick={onContinueEditing}>
            {effectiveLabels.continueEditing}
          </Button>
          <Button
            color="error"
            variant={onSaveAndContinue ? "text" : "contained"}
            disabled={saving}
            onClick={onDiscardChanges}
          >
            {effectiveLabels.discardAndLeave}
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
                effectiveLabels.saveAndContinue
              )}
            </Button>
          )}
        </>
      }
    />
  );
}

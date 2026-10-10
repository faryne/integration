import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateReport, useModerationReasons } from "@/apis/storyteller.ts";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { moderationReasonLabel } from "@/helpers/moderationReasons.ts";
import type { ReportTarget } from "@/types/storytellerReport.ts";

// 後端字數上限（ReportNoteMaxRunes）
const NOTE_MAX = 1000;

// 檢舉 dialog：原因下拉（依對象過濾）＋補充說明（「其他」必填）。
// 失敗時不關閉、保留已填內容；成功由呼叫端關閉並顯示 snack。
export function ReportDialog({
  target,
  onClose,
  onDone,
  onError,
}: {
  target: ReportTarget;
  onClose: () => void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const reasons = useModerationReasons(target.type);
  // 對象描述：依種類套樣板（留言回覆用 reply），名稱不存在時顯示「已不存在的使用者」
  const description = t(
    `moderation.report.target.${target.reply ? "reply" : target.type}`,
    { name: target.name ?? t("moderation.report.target.missingUser") },
  );
  const report = useCreateReport();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const noteRequired = Boolean(
    reasons.data?.find((r) => r.key === reason)?.note_required,
  );
  // 理由載入失敗時用 snack 告知（dialog 留著，讓人可以取消）
  useEffect(() => {
    if (reasons.isError) onError(t("moderation.report.reasonsFailed"));
  }, [reasons.isError, onError, t]);
  const canSubmit =
    reason !== "" && (!noteRequired || note.trim() !== "") && !report.isPending;

  function submit() {
    report
      .mutateAsync({
        target_type: target.type,
        target_public_id: target.publicId,
        project_public_id: target.projectPublicId,
        share: target.share,
        reason_key: reason,
        note,
      })
      .then(onDone)
      .catch((error) =>
        onError(apiErrorMessage(error, t("moderation.report.submitFailed"))),
      );
  }

  return (
    <StorytellerDialog
      open
      title={t(`moderation.report.title.${target.type}`)}
      description={description}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t("moderation.report.cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!canSubmit}
            onClick={submit}
          >
            {t("moderation.report.submit")}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          select
          label={t("moderation.report.field.reason")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          fullWidth
        >
          {(reasons.data ?? []).map((r) => (
            <MenuItem key={r.key} value={r.key}>
              {moderationReasonLabel(r.key)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t(
            noteRequired
              ? "moderation.report.field.noteRequired"
              : "moderation.report.field.note",
          )}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          multiline
          minRows={3}
          fullWidth
          slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
        />
      </Stack>
    </StorytellerDialog>
  );
}

import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { useCreateReport, useModerationReasons } from "@/apis/storyteller.ts";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { moderationReasonLabel } from "@/helpers/moderationReasons.ts";
import type {
  ReportTarget,
  ReportTargetType,
} from "@/types/storytellerReport.ts";

const TITLES: Record<ReportTargetType, string> = {
  project: "檢舉作品",
  story: "檢舉這一話",
  lore: "檢舉設定",
  author: "檢舉創作者",
  author_post: "檢舉動態",
  discussion_thread: "檢舉討論串",
  comment: "檢舉留言",
};

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
  const reasons = useModerationReasons(target.type);
  const report = useCreateReport();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const noteRequired = Boolean(
    reasons.data?.find((r) => r.key === reason)?.note_required,
  );
  // 理由載入失敗時用 snack 告知（dialog 留著，讓人可以取消）
  useEffect(() => {
    if (reasons.isError) onError("無法載入檢舉原因，請稍後再試");
  }, [reasons.isError, onError]);
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
        onError(apiErrorMessage(error, "檢舉送出失敗，請稍後再試")),
      );
  }

  return (
    <StorytellerDialog
      open
      title={TITLES[target.type]}
      description={target.label}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!canSubmit}
            onClick={submit}
          >
            送出檢舉
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField
          select
          label="原因"
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
          label={noteRequired ? "補充說明（必填）" : "補充說明"}
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

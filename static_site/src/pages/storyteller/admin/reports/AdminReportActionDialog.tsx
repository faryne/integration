import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { moderationReasonLabel } from "@/helpers/moderationReasons.ts";
import type { AdminReportDetail } from "@/types/storytellerAdmin.ts";
import { adminRemoveAction, adminTargetName } from "./adminReportLabels.ts";

export type AdminReportDialogKind = "remove" | "dismiss" | "close";

// 處置確認：移除要選理由（預設被檢舉最多次的原因），停權另外要輸入筆名才能按；駁回、結案只確認。
export function AdminReportActionDialog({
  kind,
  detail,
  pending,
  onClose,
  onConfirm,
}: {
  kind: AdminReportDialogKind;
  detail: AdminReportDetail;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reasonKey?: string) => void;
}) {
  const { t } = useTranslation();
  const { target, actions } = detail;
  const [reason, setReason] = useState(
    actions.default_reason ?? actions.remove_reasons?.[0] ?? "",
  );
  const [typed, setTyped] = useState("");
  const name = adminTargetName(target);
  const isBan = kind === "remove" && target.type === "user";
  const footprint = target.footprint;

  // 確認文案都在 i18n/zh-TW/moderation.json 的 moderation.admin.dialog
  const action = adminRemoveAction(target.type);
  const copy = {
    remove: {
      title: t("moderation.admin.dialog.removeTitle", {
        action: t(`moderation.admin.action.${action}`),
        name,
      }),
      body: isBan
        ? t("moderation.admin.dialog.banBody")
        : action === "removeProfile"
          ? t("moderation.admin.dialog.removeProfileBody", {
              posts: footprint?.posts ?? 0,
              threads: footprint?.threads ?? 0,
              comments: footprint?.comments ?? 0,
            })
          : t("moderation.admin.dialog.removeBody", { count: detail.pending }),
      ok: t(`moderation.admin.dialog.confirm.${action}`),
    },
    dismiss: {
      title: t("moderation.admin.dialog.dismissTitle"),
      body: t("moderation.admin.dialog.dismissBody"),
      ok: t("moderation.admin.dialog.confirm.dismiss"),
    },
    close: {
      title: t("moderation.admin.dialog.closeTitle"),
      body: t("moderation.admin.dialog.closeBody"),
      ok: t("moderation.admin.dialog.confirm.close"),
    },
  }[kind];
  const ready =
    kind !== "remove" ||
    (reason !== "" && (!isBan || typed.trim() === target.title));

  return (
    <StorytellerMascotDialog
      open
      state={kind === "remove" ? "danger" : "neutral"}
      title={copy.title}
      description={copy.body}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>
            {t("moderation.admin.dialog.cancel")}
          </Button>
          <Button
            variant="contained"
            color={kind === "remove" ? "error" : "primary"}
            disabled={!ready || pending}
            onClick={() => onConfirm(kind === "remove" ? reason : undefined)}
          >
            {copy.ok}
          </Button>
        </>
      }
    >
      {kind === "remove" && (
        <Stack spacing={2}>
          <TextField
            select
            label={t(
              isBan
                ? "moderation.admin.dialog.banReason"
                : "moderation.admin.dialog.removeReason",
            )}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            fullWidth
          >
            {(actions.remove_reasons ?? []).map((key) => (
              <MenuItem key={key} value={key}>
                {moderationReasonLabel(key)}
              </MenuItem>
            ))}
          </TextField>
          {isBan && (
            <TextField
              label={t("moderation.admin.dialog.typeToConfirm", {
                name: target.title,
              })}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              fullWidth
            />
          )}
        </Stack>
      )}
    </StorytellerMascotDialog>
  );
}

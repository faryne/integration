import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  useAdminReportAction,
  useAdminReportDetail,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  postFullTime,
  postTimeLabel,
} from "@/components/storyteller/timeline/postTime.ts";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { moderationReasonLabel } from "@/helpers/moderationReasons.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type {
  AdminReportDetail as Detail,
  AdminReportStatus,
  AdminTargetType,
} from "@/types/storytellerAdmin.ts";
import {
  AdminReportActionDialog,
  type AdminReportDialogKind,
} from "./AdminReportActionDialog.tsx";
import {
  adminRemoveAction,
  adminTargetHref,
  adminTargetName,
  adminTargetPlace,
  adminTargetTypeLabels,
} from "./adminReportLabels.ts";

const statusLabels: Record<AdminReportStatus, string> = {
  pending: "待處理",
  resolved: "已結案",
  dismissed: "已駁回",
};

// 檢舉詳情：對象預覽、檢舉紀錄、原因統計與處置。按鈕只依後端回的 actions 顯示，前端不自己判斷權限。
export function AdminReportDetail() {
  // :targetPublicId 是對象的 public_id（後台不使用內部流水號）
  const { targetType = "", targetPublicId = "" } = useParams();
  const type = targetType as AdminTargetType;
  const query = useAdminReportDetail(type, targetPublicId);
  const action = useAdminReportAction(type, targetPublicId);
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<AdminReportDialogKind | null>(null);
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const detail = query.data;
  const name = detail ? adminTargetName(detail.target) : "";

  function confirm(reasonKey?: string) {
    // 結案（作者已自行刪除）也走 remove 端點：後端只結案、不覆寫理由
    const request =
      dialog === "dismiss"
        ? { type: "dismiss" as const }
        : { type: "remove" as const, reasonKey: reasonKey ?? "" };
    const done = t(`moderation.admin.dialog.done.${dialog!}`);
    action.mutate(request, {
      onSuccess: () => {
        setDialog(null);
        setSnack({ message: done, severity: "success" });
      },
      onError: (error) =>
        setSnack({
          message: apiErrorMessage(error, t("moderation.admin.dialog.failed")),
          severity: "error",
        }),
    });
  }

  return (
    <StorytellerShell
      title={name || "檢舉"}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: "管理後台", to: steamloomPath("admin") },
        { label: "檢舉", to: steamloomPath("admin/reports") },
        { label: name || "…" },
      ]}
    >
      {query.isLoading ? (
        <StorytellerLoading label="正在載入檢舉..." />
      ) : !detail ? (
        <Typography color="text.secondary">
          {apiErrorMessage(query.error, "找不到這個項目")}
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "minmax(0, 1fr) 300px",
            },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Stack spacing={2} sx={{ minWidth: 0, order: { xs: 2, md: 1 } }}>
            <TargetCard detail={detail} />
            <Paper variant="outlined">
              <Typography fontWeight={800} sx={{ px: 2, pt: 1.5 }}>
                檢舉紀錄（{detail.reports.length}）
              </Typography>
              {detail.reports.map((report) => (
                <Box
                  key={report.public_id}
                  sx={{
                    px: 2,
                    py: 1.25,
                    "& + &": { borderTop: 1, borderColor: "divider" },
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      label={moderationReasonLabel(report.reason_key)}
                    />
                    <Typography variant="body2" fontWeight={700}>
                      {report.reporter_name || "已不存在的使用者"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      title={postFullTime(report.created_at)}
                    >
                      {postTimeLabel(report.created_at)}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={statusLabels[report.status]}
                    />
                    {report.handled_by && (
                      <Typography variant="caption" color="text.secondary">
                        處理者 {report.handled_by}
                      </Typography>
                    )}
                  </Stack>
                  {report.note && (
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.75, whiteSpace: "pre-line" }}
                    >
                      {report.note}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          </Stack>
          <SidePanel
            detail={detail}
            pending={action.isPending}
            onAction={setDialog}
          />
        </Box>
      )}
      {dialog && detail && (
        <AdminReportActionDialog
          kind={dialog}
          detail={detail}
          pending={action.isPending}
          onClose={() => setDialog(null)}
          onConfirm={confirm}
        />
      )}
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
    </StorytellerShell>
  );
}

function TargetCard({ detail }: { detail: Detail }) {
  const { target } = detail;
  const href = adminTargetHref(target);
  const footprint = target.footprint;
  const rows: [string, ReactNode][] = [
    [
      target.type === "user" || target.type === "author_profile"
        ? "筆名"
        : "發言者",
      target.owner_name || "已不存在的使用者",
    ],
    ["所在位置", adminTargetPlace(target)],
    ["額外筆名", target.extra_pen_names?.join("、")],
    [
      "公開足跡",
      footprint &&
        [
          footprint.projects && `${footprint.projects} 部作品`,
          `${footprint.posts} 則動態`,
          `${footprint.threads} 個討論串`,
          `${footprint.comments} 則留言`,
        ]
          .filter(Boolean)
          .join(" · "),
    ],
    ["建立時間", target.created_at && postFullTime(target.created_at)],
  ];
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 1.5 }}
      >
        <Chip
          size="small"
          color="secondary"
          variant="outlined"
          label={adminTargetTypeLabels[target.type]}
        />
        {target.type === "user" && (
          <Chip size="small" variant="outlined" label="帳號本人" />
        )}
        {target.type === "author_profile" && (
          <Chip size="small" variant="outlined" label="額外筆名" />
        )}
        {target.deleted && (
          <Chip
            size="small"
            color={target.delete_reason ? "error" : "default"}
            label={
              target.delete_reason
                ? `${target.type === "user" ? "已停權" : "已移除"}：${moderationReasonLabel(target.delete_reason)}`
                : "作者已自行刪除"
            }
          />
        )}
        {href && (
          <Link
            href={href}
            target="_blank"
            rel="noopener"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              ml: "auto",
            }}
          >
            前往查看 <OpenInNewIcon sx={{ fontSize: 16 }} />
          </Link>
        )}
      </Stack>
      {target.body && (
        <Typography
          sx={{
            p: 1.5,
            mb: 1.5,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            whiteSpace: "pre-line",
            lineHeight: 1.8,
          }}
        >
          {target.body}
        </Typography>
      )}
      <Box
        component="dl"
        sx={{
          display: "grid",
          gridTemplateColumns: "88px 1fr",
          gap: 0.75,
          m: 0,
          fontSize: 14,
        }}
      >
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <Box key={label} sx={{ display: "contents" }}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {value}
              </Typography>
            </Box>
          ))}
      </Box>
    </Paper>
  );
}

function SidePanel({
  detail,
  pending,
  onAction,
}: {
  detail: Detail;
  pending: boolean;
  onAction: (kind: AdminReportDialogKind) => void;
}) {
  const { t } = useTranslation();
  const { actions, reasons } = detail;
  const max = Math.max(...reasons.map((reason) => reason.count), 1);
  const hasAction =
    actions.can_remove || actions.can_dismiss || actions.can_close;
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        position: { md: "sticky" },
        top: { md: 88 },
        order: { xs: 1, md: 2 },
      }}
    >
      <Typography fontWeight={800} sx={{ mb: 1 }}>
        原因統計
      </Typography>
      <Stack spacing={1} sx={{ mb: 2 }}>
        {reasons.map((reason) => (
          <Box key={reason.key}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">
                {moderationReasonLabel(reason.key)}
              </Typography>
              <Typography variant="body2" fontWeight={800}>
                {reason.count}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              color="error"
              value={(reason.count / max) * 100}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        ))}
      </Stack>
      {hasAction ? (
        <Stack spacing={1}>
          {actions.can_remove && (
            <Button
              variant="contained"
              color="error"
              disabled={pending}
              onClick={() => onAction("remove")}
            >
              {t(
                `moderation.admin.action.${adminRemoveAction(detail.target.type)}`,
              )}
            </Button>
          )}
          {actions.can_close && (
            <Button
              variant="contained"
              disabled={pending}
              onClick={() => onAction("close")}
            >
              {t("moderation.admin.action.close")}
            </Button>
          )}
          {actions.can_dismiss && (
            <Button
              variant="outlined"
              disabled={pending}
              onClick={() => onAction("dismiss")}
            >
              {t("moderation.admin.action.dismiss")}
            </Button>
          )}
        </Stack>
      ) : (
        detail.pending === 0 && (
          <Typography variant="body2" color="text.secondary">
            {statusLabels[detail.reports[0]?.status ?? "resolved"]}
          </Typography>
        )
      )}
    </Paper>
  );
}

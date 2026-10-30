import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Link,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { ActressSubmissionDetail } from "@/types/avActressSubmission.ts";
import {
  useActressSubmission,
  useReviewActressSubmission,
} from "@/apis/av/actress_submission.ts";
import { ACTRESS_FIELD_LABELS } from "@/data/avActressFields.ts";
import {
  changedActressFields,
  mergeActressFields,
} from "@/helpers/avActressFields.ts";
import {
  SUBMISSION_RESOLUTION_LABEL,
  SUBMISSION_STATUS_COLOR,
  SUBMISSION_STATUS_LABEL,
  formatSubmissionTime,
  submitterLabel,
} from "@/helpers/avActressSubmission.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useTitle } from "@/helpers/title.tsx";
import { AdminGuard } from "@/components/common/AdminGuard.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { ActressSubmissionDiff } from "@/components/av/actress_submission_diff.tsx";
import {
  ApproveDialog,
  RejectDialog,
} from "@/components/av/actress_review_dialogs.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

/** 審核頁：/av/actress/submissions/:id */
export function AVActressSubmissionReview() {
  const id = Number(useParams<{ id: string }>().id) || 0;
  useTitle(`女優上稿審核 #${id}`);
  useBreadcrumbTail(`#${id}`);
  return (
    <AdminGuard>
      <Review id={id} />
    </AdminGuard>
  );
}

function Review({ id }: { id: number }) {
  const detail = useActressSubmission(id);
  if (detail.isError)
    return (
      <ErrorPage
        backUrl="/av/actress/submissions"
        code={404}
        message="找不到這張提交單"
      />
    );
  if (!detail.data) return <Skeleton height={480} variant="rounded" />;
  return <ReviewContent d={detail.data} />;
}

function ReviewContent({ d }: { d: ActressSubmissionDetail }) {
  const { approve, reject } = useReviewActressSubmission(d.id);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [snack, setSnack] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const isEdit = d.kind === "edit";
  const sameNames = isEdit ? [] : d.duplicates.filter((c) => c.exact_name);
  const kanaOnly = isEdit ? [] : d.duplicates.filter((c) => !c.exact_name);
  const [mergeTarget, setMergeTarget] = useState(
    sameNames[0] ? `${sameNames[0].domain}-${sameNames[0].aid}` : "",
  );
  const mergeCandidate = sameNames.find(
    (c) => `${c.domain}-${c.aid}` === mergeTarget,
  );
  // 修改單：提交後被改過的欄位；新增單有同名時，拿選中的那位來比對
  const drifted =
    d.base && d.current ? changedActressFields(d.base, d.current) : [];
  const left = isEdit ? d.base : (mergeCandidate?.fields ?? null);
  const done = (message: string) => () => {
    setDialog(null);
    setSnack({ message });
  };
  const failed = (error: unknown) =>
    setSnack({
      message: apiErrorMessage(error, "操作失敗，請稍後再試"),
      error: true,
    });
  const actressPage = `/av/actress/${encodeURIComponent(d.payload.name)}`;

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Box>
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1}
          sx={{ alignItems: "center" }}
        >
          <Typography fontWeight={900} variant="h5">
            #{d.id} {d.name}
          </Typography>
          <Chip
            color={isEdit ? "secondary" : "primary"}
            label={isEdit ? "修改" : "新增"}
            size="small"
            variant="outlined"
          />
          <Chip
            color={SUBMISSION_STATUS_COLOR[d.status]}
            label={SUBMISSION_STATUS_LABEL[d.status]}
            size="small"
          />
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {formatSubmissionTime(d.created_at)} 由 {submitterLabel(d)} 提交
          {d.channel === "mcp" ? "（MCP）" : ""}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 300px" },
          alignItems: "start",
        }}
      >
        <Paper sx={{ p: 2 }} variant="outlined">
          <Stack spacing={1.5}>
            {d.status === "approved" && (
              <Alert severity="success">
                {formatSubmissionTime(d.reviewed_at)} 已核准（
                {SUBMISSION_RESOLUTION_LABEL[d.resolution]}）。
                <Link component={RouterLink} to={actressPage}>
                  查看女優頁
                </Link>
              </Alert>
            )}
            {d.status === "rejected" && (
              <Alert severity="info">
                {formatSubmissionTime(d.reviewed_at)} 否決
                {d.review_note ? `：${d.review_note}` : ""}
                。改為核准時會以現在的資料重新比對。
              </Alert>
            )}
            {d.status !== "approved" && drifted.length > 0 && (
              <Alert severity="warning">
                提交後這些欄位被改過：
                {drifted.map((k) => ACTRESS_FIELD_LABELS[k]).join("、")}
                。核准只套用提交者改的欄位，其他維持現在的值。
              </Alert>
            )}
            {d.status !== "approved" && sameNames.length > 0 && (
              <Alert severity="warning">
                已有同名女優，核准時只能合併到既有女優。下表為合併後與該女優的差異。
              </Alert>
            )}
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography fontWeight={700}>
                {left ? "變更內容" : "提交內容"}
              </Typography>
              {left && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={onlyChanged}
                      onChange={(e) => setOnlyChanged(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">只顯示有差異的欄位</Typography>
                  }
                />
              )}
            </Stack>
            <ActressSubmissionDiff
              left={left}
              leftLabel={
                isEdit
                  ? drifted.length
                    ? "提交時的值"
                    : "目前的值"
                  : "同名女優的值"
              }
              now={isEdit && d.status !== "approved" ? d.current : null}
              onlyChanged={Boolean(left) && onlyChanged}
              right={
                mergeCandidate
                  ? mergeActressFields(mergeCandidate.fields, d.payload)
                  : d.payload
              }
              rightLabel={mergeCandidate ? "合併後的值" : "提交的值"}
            />
          </Stack>
        </Paper>

        <Stack spacing={2}>
          <Paper sx={{ p: 2 }} variant="outlined">
            <ActressPhoto
              alt={d.payload.name}
              src={d.payload.photo}
              sx={{ borderRadius: 2, mx: "auto", width: 160 }}
            />
            {isEdit && (
              <Typography
                color="text.secondary"
                sx={{ mt: 1.5 }}
                variant="body2"
              >
                {d.target_domain === "xcity"
                  ? "xcity 女優：改過的欄位存成覆寫，之後同步不會蓋掉"
                  : "手動上稿的女優：直接更新資料"}
              </Typography>
            )}
          </Paper>
          {(sameNames.length > 0 || kanaOnly.length > 0) && (
            <Paper sx={{ p: 2 }} variant="outlined">
              <Typography fontWeight={700} variant="body2">
                {sameNames.length ? "同名女優" : "假名相同的女優"}
              </Typography>
              {[...sameNames, ...kanaOnly].map((c) => (
                <Typography
                  key={`${c.domain}-${c.aid}`}
                  sx={{ mt: 1 }}
                  variant="body2"
                >
                  <Link
                    component={RouterLink}
                    target="_blank"
                    to={`/av/actress/${encodeURIComponent(c.fields.name)}`}
                  >
                    {c.fields.name}
                  </Link>
                  <Box component="span" sx={{ color: "text.secondary", ml: 1 }}>
                    {c.domain}-{c.aid}
                    {c.fields.birth_year
                      ? `・${c.fields.birth_year}/${c.fields.birth_month}/${c.fields.birth_day}`
                      : "・生日未登錄"}
                  </Box>
                </Typography>
              ))}
            </Paper>
          )}
          {d.status !== "approved" && (
            <Paper sx={{ display: "flex", gap: 1, p: 2 }} variant="outlined">
              {d.status === "pending" && (
                <Button
                  color="error"
                  fullWidth
                  onClick={() => setDialog("reject")}
                  variant="contained"
                >
                  否決
                </Button>
              )}
              <Button
                fullWidth
                onClick={() => setDialog("approve")}
                variant="contained"
              >
                {d.status === "rejected" ? "改為核准" : "核准"}
              </Button>
            </Paper>
          )}
        </Stack>
      </Box>

      <ApproveDialog
        loading={approve.isPending}
        mergeTarget={mergeTarget}
        message={
          isEdit
            ? `會更新「${d.name}」的 ${d.changed_fields.length} 個欄位，並立即反映到搜尋結果。`
            : `會新增女優「${d.name}」，並立即出現在搜尋結果。`
        }
        onClose={() => setDialog(null)}
        onConfirm={() =>
          approve.mutate(mergeTarget, {
            onSuccess: done("已核准"),
            onError: failed,
          })
        }
        onMergeTargetChange={setMergeTarget}
        open={dialog === "approve"}
        sameNames={sameNames}
      />
      <RejectDialog
        loading={reject.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(note) =>
          reject.mutate(note, { onSuccess: done("已否決"), onError: failed })
        }
        open={dialog === "reject"}
      />
      <CustomSnackbar
        message={snack?.message ?? ""}
        onClose={() => setSnack(null)}
        open={snack !== null}
        severity={snack?.error ? "error" : "success"}
      />
    </Stack>
  );
}

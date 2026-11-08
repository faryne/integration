import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { VideoSubmissionDetail } from "@/types/avVideoSubmission.ts";
import {
  useFindNextPendingVideoSubmission,
  useReviewVideoSubmission,
  useVideoSubmission,
} from "@/apis/av/video_submission.ts";
import { VIDEO_FIELD_LABELS } from "@/data/avVideoFields.ts";
import { changedVideoFields, videoDiffSpec } from "@/helpers/avVideoFields.ts";
import {
  SUBMISSION_STATUS_COLOR,
  SUBMISSION_STATUS_LABEL,
  formatSubmissionTime,
  submitterLabel,
} from "@/helpers/avActressSubmission.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useFlashMessage } from "@/helpers/flashMessage.ts";
import {
  avAdminVideoSubmissionPath,
  avAdminVideoSubmissionsPath,
} from "@/helpers/backendAdmin.ts";
import { AvCoverImage } from "@/components/av/av_cover_image.tsx";
import { SubmissionDiff } from "@/components/av/submission_diff.tsx";
import { RejectDialog } from "@/components/av/submission_reject_dialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { joyuPath } from "@/helpers/joyu.ts";

const VIDEO_REJECT_REASONS = [
  "資料來源不可信",
  "資料有誤",
  "不是這部影片",
  "沒有實質變更",
];

const videoPath = (no: string) => joyuPath(`video/${encodeURIComponent(no)}`);

/** 影片修改審核頁：/backend_admin/av/video-submissions/:id；權限由後台 layout 檢查 */
export function AVVideoSubmissionReview() {
  const id = Number(useParams<{ id: string }>().id) || 0;
  useBreadcrumbTail(`#${id}`);
  const flash = useFlashMessage();
  return (
    <>
      <Review id={id} />
      <CustomSnackbar
        message={flash.message ?? ""}
        onClose={flash.close}
        open={flash.message !== null}
      />
    </>
  );
}

function Review({ id }: { id: number }) {
  const detail = useVideoSubmission(id);
  if (detail.isError)
    return (
      <ErrorPage
        backUrl={avAdminVideoSubmissionsPath}
        code={404}
        message="找不到這張提交單"
      />
    );
  if (!detail.data) return <Skeleton height={480} variant="rounded" />;
  // 換到下一張時用 key 重置對話框等狀態
  return <ReviewContent d={detail.data} key={detail.data.id} />;
}

function ReviewContent({ d }: { d: VideoSubmissionDetail }) {
  const { approve, reject } = useReviewVideoSubmission(d.id);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);
  const spec = useMemo(() => videoDiffSpec(d), [d]);
  const reviewing = d.status !== "approved";
  // 提交後被改過的欄位（DMM 同步或另一張單先核准）
  const drifted = d.current ? changedVideoFields(d.base, d.current) : [];
  const code = d.maker_no || d.target_no.toUpperCase();
  const navigate = useNavigate();
  const findNext = useFindNextPendingVideoSubmission();
  // 核准／否決後直接接著審下一張待審單；沒有了就回列表，結果用 flash 帶到下一頁顯示
  const done = (message: string) => async () => {
    setDialog(null);
    const next = await findNext(d.id).catch(() => null);
    navigate(
      next ? avAdminVideoSubmissionPath(next) : avAdminVideoSubmissionsPath,
      {
        state: {
          flash: next
            ? `${message}，接著審核 #${next}`
            : `${message}，沒有待審核的單了`,
        },
      },
    );
  };
  const failed = (error: unknown) =>
    setSnack(apiErrorMessage(error, "操作失敗，請稍後再試"));
  const newValueCount = Object.values(d.new_values).flat().length;

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
            #{d.id} 修改{" "}
            <Link
              component={RouterLink}
              target="_blank"
              to={videoPath(d.target_no)}
            >
              {code}
            </Link>
          </Typography>
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
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 260px" },
          alignItems: "start",
        }}
      >
        <Paper sx={{ p: 2 }} variant="outlined">
          <Stack spacing={1.5}>
            {d.status === "approved" && (
              <Alert severity="success">
                {formatSubmissionTime(d.reviewed_at)} 已核准。
                <Link
                  component={RouterLink}
                  target="_blank"
                  to={videoPath(d.target_no)}
                >
                  查看影片頁
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
            {reviewing && d.missing && (
              <Alert severity="error">
                搜尋裡已經找不到這部影片，只能否決。
              </Alert>
            )}
            {reviewing && drifted.length > 0 && (
              <Alert severity="warning">
                提交後這些欄位被改過：
                {drifted.map((k) => VIDEO_FIELD_LABELS[k]).join("、")}
                。核准只套用提交者改的欄位，其他維持現在的值。
              </Alert>
            )}
            {reviewing && d.maker_no_taken.length > 0 && (
              <Alert severity="warning">
                官方番號 <b>{d.payload.maker_no}</b> 已經被別部影片使用：
                {d.maker_no_taken.map((v) => (
                  <Link
                    component={RouterLink}
                    key={v.no}
                    sx={{ ml: 0.5 }}
                    target="_blank"
                    to={videoPath(v.no)}
                  >
                    {v.no.toUpperCase()} {v.title}
                  </Link>
                ))}
                。確認不是同一部再核准。
              </Alert>
            )}
            {reviewing && d.same_name_actresses.length > 0 && (
              <Alert severity="warning">
                {d.same_name_actresses.join("、")}
                有同名的女優，新加的出演沒有 DMM 女優
                ID，可能會歸到另一位同名女優的頁面。
              </Alert>
            )}
            {reviewing && newValueCount > 0 && (
              <Alert severity="info">
                有 {newValueCount}{" "}
                個值在影片庫裡還沒出現過（標「新值」），請確認不是打錯字。
              </Alert>
            )}
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography fontWeight={700}>變更內容</Typography>
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
            </Stack>
            <SubmissionDiff
              left={d.base}
              leftLabel={drifted.length ? "提交時的值" : "目前的值"}
              now={reviewing ? d.current : null}
              onlyChanged={onlyChanged}
              right={d.payload}
              spec={spec}
            />
          </Stack>
        </Paper>

        <Stack spacing={2}>
          <Paper sx={{ p: 2 }} variant="outlined">
            <AvCoverImage
              alt={d.title}
              src={d.thumb}
              sx={{ borderRadius: 2, display: "block", mx: "auto", width: 160 }}
            />
            <Typography sx={{ mt: 1.5 }} variant="body2">
              {d.title}
            </Typography>
          </Paper>
          {reviewing && (
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
                disabled={d.missing}
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

      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => setDialog(null)}
        open={dialog === "approve"}
      >
        <DialogTitle>核准這張提交單？</DialogTitle>
        <DialogContent>
          <Typography>
            會更新「{code}」的 {d.changed_fields.length}{" "}
            個欄位，並立即反映到搜尋結果；之後 DMM 同步也不會蓋掉。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>取消</Button>
          <Button
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate({}, { onSuccess: done("已核准"), onError: failed })
            }
            startIcon={
              approve.isPending ? (
                <CircularProgress color="inherit" size={16} />
              ) : undefined
            }
            variant="contained"
          >
            核准
          </Button>
        </DialogActions>
      </Dialog>
      <RejectDialog
        loading={reject.isPending}
        onClose={() => setDialog(null)}
        onConfirm={(note) =>
          reject.mutate(note, { onSuccess: done("已否決"), onError: failed })
        }
        open={dialog === "reject"}
        reasons={VIDEO_REJECT_REASONS}
      />
      <CustomSnackbar
        message={snack ?? ""}
        onClose={() => setSnack(null)}
        open={snack !== null}
        severity="error"
      />
    </Stack>
  );
}

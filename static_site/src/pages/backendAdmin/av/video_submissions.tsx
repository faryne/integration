import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Chip,
  Link,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import type { SubmissionStatus } from "@/types/avSubmission.ts";
import {
  usePendingVideoSubmissionCount,
  useVideoSubmissions,
} from "@/apis/av/video_submission.ts";
import { VIDEO_FIELD_LABELS } from "@/data/avVideoFields.ts";
import {
  SUBMISSION_STATUS_LABEL,
  formatSubmissionTime,
  submitterLabel,
} from "@/helpers/avActressSubmission.ts";
import { avAdminVideoSubmissionPath } from "@/helpers/backendAdmin.ts";
import { useFlashMessage } from "@/helpers/flashMessage.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

const STATUSES: SubmissionStatus[] = ["pending", "approved", "rejected"];

/** 影片修改審核列表：/backend_admin/av/video-submissions?status=&page=（狀態與頁碼存在網址）；權限由後台 layout 檢查 */
export function AVVideoSubmissions() {
  const flash = useFlashMessage();
  return (
    <>
      <SubmissionList />
      {/* 審核完最後一張回到列表時的結果提示 */}
      <CustomSnackbar
        message={flash.message ?? ""}
        onClose={flash.close}
        open={flash.message !== null}
      />
    </>
  );
}

function SubmissionList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = STATUSES.find((s) => s === params.get("status")) ?? "pending";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const list = useVideoSubmissions(status, page);
  const pending = usePendingVideoSubmissionCount(true);
  const rows = list.data?.data ?? [];
  const reviewed = status !== "pending";
  const desktop = { display: { xs: "none", md: "table-cell" } };

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Typography component="h1" fontWeight={900} variant="h5">
        影片修改審核
      </Typography>
      <Paper variant="outlined">
        <Tabs
          onChange={(_, v: SubmissionStatus) => setParams({ status: v })}
          sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
          value={status}
        >
          {STATUSES.map((s) => (
            <Tab
              key={s}
              label={
                s === "pending" && pending.data
                  ? `${SUBMISSION_STATUS_LABEL[s]}（${pending.data}）`
                  : SUBMISSION_STATUS_LABEL[s]
              }
              value={s}
            />
          ))}
        </Tabs>
        {list.isPending ? (
          <Skeleton height={240} sx={{ m: 2 }} variant="rounded" />
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>
            沒有提交單
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>影片</TableCell>
                <TableCell sx={desktop}>變更欄位</TableCell>
                <TableCell sx={desktop}>提交者</TableCell>
                <TableCell>時間</TableCell>
                {reviewed && <TableCell sx={desktop}>審核</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  hover
                  key={s.id}
                  onClick={() => navigate(avAdminVideoSubmissionPath(s.id))}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{s.id}</TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap={0.5}
                      sx={{ alignItems: "center" }}
                    >
                      <Link
                        component={RouterLink}
                        fontWeight={700}
                        onClick={(e) => e.stopPropagation()}
                        to={avAdminVideoSubmissionPath(s.id)}
                      >
                        {s.maker_no || s.target_no.toUpperCase()}
                      </Link>
                      {s.conflict && (
                        <Chip color="warning" label="資料已變更" size="small" />
                      )}
                      {s.missing && (
                        <Chip color="error" label="找不到影片" size="small" />
                      )}
                    </Stack>
                    <Typography color="text.secondary" noWrap variant="body2">
                      {s.title}
                    </Typography>
                  </TableCell>
                  <TableCell sx={desktop}>
                    {s.changed_fields
                      .map((k) => VIDEO_FIELD_LABELS[k])
                      .join("、")}
                  </TableCell>
                  <TableCell sx={desktop}>
                    {submitterLabel(s)}{" "}
                    {s.channel === "mcp" && <Chip label="MCP" size="small" />}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatSubmissionTime(s.created_at)}
                  </TableCell>
                  {reviewed && (
                    <TableCell sx={desktop}>{s.review_note}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
      {(list.data?.last_page ?? 1) > 1 && (
        <Pagination
          count={list.data?.last_page}
          onChange={(_, p) => setParams({ status, page: String(p) })}
          page={page}
          sx={{ alignSelf: "center" }}
        />
      )}
    </Stack>
  );
}

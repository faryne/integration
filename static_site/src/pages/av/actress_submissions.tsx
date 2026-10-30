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
import type { ActressSubmissionStatus } from "@/types/avActressSubmission.ts";
import {
  useActressSubmissions,
  usePendingActressSubmissionCount,
} from "@/apis/av/actress_submission.ts";
import {
  SUBMISSION_RESOLUTION_LABEL,
  SUBMISSION_STATUS_LABEL,
  formatSubmissionTime,
  submitterLabel,
} from "@/helpers/avActressSubmission.ts";
import { useTitle } from "@/helpers/title.tsx";
import { AdminGuard } from "@/components/common/AdminGuard.tsx";

const STATUSES: ActressSubmissionStatus[] = ["pending", "approved", "rejected"];

/** 女優上稿審核列表：/av/actress/submissions?status=&page=（狀態與頁碼存在網址） */
export function AVActressSubmissions() {
  useTitle("AV 女優上稿審核");
  return (
    <AdminGuard>
      <SubmissionList />
    </AdminGuard>
  );
}

function SubmissionList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (STATUSES.find((s) => s === params.get("status")) ??
    "pending") as ActressSubmissionStatus;
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const list = useActressSubmissions(status, page);
  const pending = usePendingActressSubmissionCount(true);
  const rows = list.data?.data ?? [];
  const reviewed = status !== "pending";

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Typography fontWeight={900} variant="h5">
        AV 女優上稿審核
      </Typography>
      <Paper variant="outlined">
        <Tabs
          onChange={(_, v: ActressSubmissionStatus) => setParams({ status: v })}
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
                <TableCell>類型</TableCell>
                <TableCell>女優</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  變更欄位
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  提交者
                </TableCell>
                <TableCell>時間</TableCell>
                {reviewed && (
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    審核
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  hover
                  key={s.id}
                  onClick={() => navigate(`/av/actress/submissions/${s.id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{s.id}</TableCell>
                  <TableCell>
                    <Chip
                      color={s.kind === "edit" ? "secondary" : "primary"}
                      label={s.kind === "edit" ? "修改" : "新增"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      gap={0.5}
                      sx={{ alignItems: "center" }}
                    >
                      <Link
                        component={RouterLink}
                        onClick={(e) => e.stopPropagation()}
                        to={`/av/actress/submissions/${s.id}`}
                      >
                        {s.name}
                      </Link>
                      {s.conflict && (
                        <Chip color="warning" label="資料已變更" size="small" />
                      )}
                      {s.duplicate && (
                        <Chip color="warning" label="同名女優" size="small" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {s.changed_fields.length} 個
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    {submitterLabel(s)}{" "}
                    {s.channel === "mcp" && <Chip label="MCP" size="small" />}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {formatSubmissionTime(s.created_at)}
                  </TableCell>
                  {reviewed && (
                    <TableCell
                      sx={{ display: { xs: "none", md: "table-cell" } }}
                    >
                      {SUBMISSION_RESOLUTION_LABEL[s.resolution] ||
                        s.review_note}
                    </TableCell>
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

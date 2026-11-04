import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Link,
  MenuItem,
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
  TextField,
  Typography,
} from "@mui/material";

import {
  NEKOMAID_ADMIN_PAGE_SIZE,
  useCreateNekomaidForbidden,
  useDeleteNekomaidForbidden,
  useNekomaidForbiddenList,
} from "@/apis/nekomaid/forbiddenAdmin.ts";
import { AdminPagination } from "@/components/backendAdmin/AdminPagination.tsx";
import { ForbiddenCreateDialog } from "@/components/backendAdmin/nekomaid/ForbiddenCreateDialog.tsx";
import { useActionFeedback } from "@/components/backendAdmin/useActionFeedback.tsx";
import { useTabParam } from "@/components/backendAdmin/useTabParam.ts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { formatSubmissionTime } from "@/helpers/avActressSubmission.ts";
import { siteLabels } from "@/helpers/nekomaid.ts";
import {
  FORBIDDEN_SOURCE_LABEL,
  nekomaidTargetPath,
} from "@/helpers/nekomaidForbidden.ts";
import type { NekomaidForbidden } from "@/types/nekomaidForbidden.ts";

// 分頁：全部／待從搜尋移除（同步 job 還沒跑）／已移除
const TABS = ["all", "pending", "done"] as const;
const TAB_LABEL = { all: "全部", pending: "待移除", done: "已移除" };

/** 禁抓名單：/backend_admin/nekomaid/forbidden?tab=all|pending|done；禁抓只把作品從搜尋（ES）拉掉，解除後會回補 */
export function NekomaidAdminForbidden() {
  const [tab, setTab] = useTabParam(TABS);
  const [site, setSite] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<NekomaidForbidden | null>(null);
  const [notice, setNotice] = useState("");
  const list = useNekomaidForbiddenList({
    site,
    keyword: keyword.trim(),
    status: tab === "all" ? "" : tab,
    page,
  });
  const create = useCreateNekomaidForbidden();
  const remove = useDeleteNekomaidForbidden();
  const feedback = useActionFeedback("操作失敗，請稍後再試");
  const rows = list.data?.data ?? [];

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Typography component="h1" fontWeight={900} variant="h5">
        禁抓名單
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <TextField
          label="來源站"
          onChange={(e) => {
            setSite(e.target.value);
            setPage(1);
          }}
          select
          size="small"
          sx={{ minWidth: 160 }}
          value={site}
        >
          <MenuItem value="">全部</MenuItem>
          {Object.entries(siteLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="畫師 ID、作品 ID 或暱稱"
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          size="small"
          sx={{ flex: 1 }}
          value={keyword}
        />
        <Button onClick={() => setCreating(true)} variant="contained">
          新增禁抓
        </Button>
      </Stack>
      <Paper variant="outlined">
        <Tabs
          onChange={(_, value: (typeof TABS)[number]) => {
            setTab(value);
            setPage(1);
          }}
          sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
          value={tab}
        >
          {TABS.map((key) => (
            <Tab key={key} label={TAB_LABEL[key]} value={key} />
          ))}
        </Tabs>
        {list.isPending ? (
          <Skeleton height={240} sx={{ m: 2 }} variant="rounded" />
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>
            沒有符合的禁抓
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>來源站</TableCell>
                  <TableCell>畫師</TableCell>
                  <TableCell>範圍</TableCell>
                  <TableCell>來源</TableCell>
                  <TableCell>備註</TableCell>
                  <TableCell>搜尋狀態</TableCell>
                  <TableCell>建立時間</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <ForbiddenRow
                    key={row.id}
                    onRemove={() => setRemoving(row)}
                    row={row}
                  />
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
      <AdminPagination
        onChange={setPage}
        page={page}
        perPage={list.data?.per_page ?? NEKOMAID_ADMIN_PAGE_SIZE}
        total={list.data?.total}
      />

      <ForbiddenCreateDialog
        loading={create.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: () => {
              setCreating(false);
              setNotice("已新增，5 分鐘內從搜尋移除");
            },
            onError: feedback.failed,
          })
        }
        open={creating}
      />
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="解除"
        loading={remove.isPending}
        message={
          removing
            ? `解除後 ${siteLabels[removing.site] ?? removing.site} ${
                removing.artwork_id
                  ? `作品 ${removing.artwork_id}`
                  : `畫師 ${removing.nickname || removing.author_id}`
              } 可以重新被抓取，已收錄的作品會回到搜尋。`
            : ""
        }
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing)
            remove.mutate(removing.id, {
              onSuccess: () => setNotice("已解除，5 分鐘內回到搜尋"),
              onError: feedback.failed,
            });
          setRemoving(null);
        }}
        open={removing !== null}
        title="確定解除禁抓？"
      />
      <CustomSnackbar
        message={notice}
        onClose={() => setNotice("")}
        open={notice !== ""}
      />
      {feedback.snackbar}
    </Stack>
  );
}

function ForbiddenRow({
  row,
  onRemove,
}: {
  row: NekomaidForbidden;
  onRemove: () => void;
}) {
  return (
    <TableRow>
      <TableCell>{siteLabels[row.site] ?? row.site}</TableCell>
      <TableCell>
        {row.nickname || (
          <Typography color="text.secondary" component="span" variant="body2">
            （無暱稱）
          </Typography>
        )}
        <Link
          href={nekomaidTargetPath(row.site, row.author_id)}
          rel="noopener"
          sx={{ display: "block", fontSize: 12 }}
          target="_blank"
        >
          {row.author_id || "（畫師 ID 空白）"}
        </Link>
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {row.artwork_id ? (
          <>
            作品{" "}
            <Link
              href={nekomaidTargetPath(row.site, row.author_id, row.artwork_id)}
              rel="noopener"
              target="_blank"
            >
              {row.artwork_id}
            </Link>
          </>
        ) : (
          "整個畫師"
        )}
      </TableCell>
      <TableCell>
        <Chip label={FORBIDDEN_SOURCE_LABEL[row.source]} size="small" />
      </TableCell>
      <TableCell>{row.note || "—"}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <Chip
          color={row.is_proceed ? "success" : "warning"}
          label={row.is_proceed ? "已移除" : "待移除"}
          size="small"
          variant="outlined"
        />
        {row.finish_time && (
          <Typography color="text.secondary" display="block" variant="caption">
            {formatSubmissionTime(row.finish_time)}
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {formatSubmissionTime(row.created_at)}
      </TableCell>
      <TableCell>
        <Button
          color="error"
          onClick={onRemove}
          size="small"
          variant="outlined"
        >
          解除
        </Button>
      </TableCell>
    </TableRow>
  );
}

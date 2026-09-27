import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  useCreateStorytellerAuditArchiveQuery,
  useStorytellerAuditArchiveQuery,
  useStorytellerAuditArchiveResults,
  useStorytellerAuditEventFilters,
} from "@/apis/storyteller/audit.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerAuditAdvancedFilters } from "@/pages/storyteller/StorytellerAuditAdvancedFilters.tsx";
import {
  AuditEventDetailDrawer,
  AuditEventItems,
} from "@/pages/storyteller/StorytellerAuditEventRows.tsx";
import {
  auditErrorMessage,
  emptyAuditAdvancedFilters,
  groupAuditEvents,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type {
  StorytellerAuditAdvancedFilterValues,
  StorytellerAuditArchiveMonths,
  StorytellerAuditEvent,
} from "@/types/storyteller.ts";

// 失敗原因只有固定分類，不會拿到 Athena 的錯誤原文。
const archiveErrorLabels: Record<string, string> = {
  query_start_failed: "查詢沒有成功送出，請稍後再試。",
  query_failed:
    "查詢執行失敗，可能是範圍太大超過單次掃描上限，請縮小月份範圍再試。",
};

function monthSpan(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// StorytellerAuditArchivePanel 是活動紀錄的封存模式：選月份與篩選條件送出 Athena 查詢，
// 輪詢到完成後用與近期列表相同的列與詳情抽屜顯示結果；不與近期資料混在同一個列表。
export function StorytellerAuditArchivePanel({
  months,
}: {
  months: StorytellerAuditArchiveMonths;
}) {
  const availableMonths = useMemo(
    () =>
      months.months
        .filter((month) => month.status === "available")
        .map((month) => month.month),
    [months],
  );
  const purgedMonths = months.months
    .filter((month) => month.status === "purged")
    .map((month) => month.month);
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");
  const [filters, setFilters] = useState(emptyAuditAdvancedFilters);
  const [queryPublicId, setQueryPublicId] = useState<string>();
  const [selected, setSelected] = useState<StorytellerAuditEvent | null>(null);
  const [snack, setSnack] = useState("");
  const filterOptions = useStorytellerAuditEventFilters();
  const createQuery = useCreateStorytellerAuditArchiveQuery();
  const job = useStorytellerAuditArchiveQuery(queryPublicId);
  const status = job.data?.status;
  const results = useStorytellerAuditArchiveResults(
    queryPublicId,
    status === "succeeded",
  );

  // 預設查最近一個可查詢的月份，使用者不必每次都自己選。
  const from = monthFrom || months.latest_archive_month || "";
  const to = monthTo || months.latest_archive_month || "";
  const span = from && to ? monthSpan(from, to) : 0;
  const rangeError =
    span <= 0
      ? "結束月份不能早於開始月份"
      : span > months.max_span_months
        ? `一次最多查詢 ${months.max_span_months} 個月`
        : "";
  const running = status === "queued" || status === "running";

  useEffect(() => {
    if (job.isError) setSnack(auditErrorMessage(job.error));
  }, [job.isError, job.error]);
  useEffect(() => {
    if (results.isError) setSnack(auditErrorMessage(results.error));
  }, [results.isError, results.error]);

  const items = useMemo(
    () =>
      (results.data?.pages ?? []).flatMap((page) =>
        groupAuditEvents(page.events),
      ),
    [results.data],
  );
  const update = (patch: Partial<StorytellerAuditAdvancedFilterValues>) =>
    setFilters((value) => ({ ...value, ...patch }));

  function submit() {
    createQuery.mutate(
      {
        month_from: from,
        month_to: to,
        filters: {
          project_public_id: filters.projectPublicId || undefined,
          category: filters.category || undefined,
          source: filters.source || undefined,
          outcome: filters.outcome || undefined,
          credential_ref: filters.credentialRef || undefined,
          include_low_importance: filters.includeLowImportance || undefined,
        },
      },
      {
        onSuccess: (created) => setQueryPublicId(created.query_public_id),
        onError: (error) => setSnack(auditErrorMessage(error)),
      },
    );
  }

  if (!months.archive_available) {
    return (
      <Alert severity="info">
        封存查詢尚未開放：系統還沒設定封存儲存空間，目前只能查詢近 3
        個月的紀錄。
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography fontWeight={800}>查詢封存紀錄</Typography>
            <Typography variant="body2" color="text.secondary">
              3 個月以前的紀錄已封存，查詢會在背景執行，需要指定月份範圍（最多{" "}
              {months.max_span_months} 個月）。
            </Typography>
          </Box>
          {availableMonths.length === 0 ? (
            <Alert severity="info">目前還沒有可以查詢的封存月份。</Alert>
          ) : (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "flex-start" }}
            >
              <TextField
                select
                size="small"
                label="開始月份"
                value={from}
                onChange={(event) => setMonthFrom(event.target.value)}
                sx={{ minWidth: 160 }}
              >
                {availableMonths.map((month) => (
                  <MenuItem key={month} value={month}>
                    {month}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="結束月份"
                value={to}
                onChange={(event) => setMonthTo(event.target.value)}
                error={Boolean(rangeError)}
                helperText={rangeError || " "}
                sx={{ minWidth: 160 }}
              >
                {availableMonths.map((month) => (
                  <MenuItem key={month} value={month}>
                    {month}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                onClick={submit}
                disabled={
                  Boolean(rangeError) || createQuery.isPending || running
                }
              >
                {createQuery.isPending ? "送出中…" : "送出查詢"}
              </Button>
            </Stack>
          )}
          <StorytellerAuditAdvancedFilters
            value={filters}
            options={filterOptions.data}
            onChange={update}
          />
          {purgedMonths.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              已超過 {months.retention_years} 年保存期限並已刪除：
              {purgedMonths.join("、")}
            </Typography>
          )}
        </Stack>
      </Paper>

      {!queryPublicId ? null : running || job.isLoading ? (
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress size={28} />
            <Typography fontWeight={700}>
              {status === "running" ? "查詢執行中…" : "查詢排隊中…"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              封存查詢通常需要幾秒到幾十秒，請保持這個頁面開啟。
            </Typography>
          </Stack>
        </Paper>
      ) : status === "failed" ? (
        <Alert severity="error">
          {archiveErrorLabels[job.data?.error_category ?? ""] ??
            "查詢失敗，請稍後再試。"}
        </Alert>
      ) : status === "expired" ? (
        <Alert severity="warning">
          這次查詢的結果已超過保留時間，請重新送出查詢。
        </Alert>
      ) : status === "succeeded" ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {job.data?.month_from} ～ {job.data?.month_to} 的查詢結果
            {job.data?.scanned_bytes !== undefined &&
              `（掃描 ${formatBytes(job.data.scanned_bytes)}）`}
          </Typography>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {results.isLoading ? (
              <Stack alignItems="center" sx={{ py: 6 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : items.length === 0 ? (
              <Typography sx={{ py: 6, textAlign: "center" }} fontWeight={700}>
                這段期間沒有符合條件的紀錄
              </Typography>
            ) : (
              <AuditEventItems items={items} onOpen={setSelected} />
            )}
          </Paper>
          {results.hasNextPage && (
            <Button
              variant="outlined"
              onClick={() => results.fetchNextPage()}
              disabled={results.isFetchingNextPage}
              sx={{ alignSelf: "center" }}
            >
              {results.isFetchingNextPage ? "載入中…" : "載入更多"}
            </Button>
          )}
        </Stack>
      ) : null}

      <AuditEventDetailDrawer
        event={selected}
        onClose={() => setSelected(null)}
      />
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        severity="error"
        onClose={() => setSnack("")}
      />
    </Stack>
  );
}

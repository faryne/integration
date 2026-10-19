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
import { useTranslation } from "react-i18next";
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
// 封存查詢錯誤分類的文案：web.audit.archive.errors.<category>，查不到用通用文案
const archiveErrorCategories = ["query_start_failed", "query_failed"];

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
  const { t } = useTranslation();
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
      ? t("web.audit.archive.errors.endBeforeStart")
      : span > months.max_span_months
        ? t("web.audit.archive.errors.maxSpan", {
            months: months.max_span_months,
          })
        : "";
  const running = status === "queued" || status === "running";

  useEffect(() => {
    if (filterOptions.isError) setSnack(auditErrorMessage(filterOptions.error));
  }, [filterOptions.isError, filterOptions.error]);
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
      <Alert severity="info">{t("web.audit.archive.notConfigured")}</Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography fontWeight={800}>
              {t("web.audit.archive.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("web.audit.archive.description", {
                months: months.max_span_months,
              })}
            </Typography>
          </Box>
          {availableMonths.length === 0 ? (
            <Alert severity="info">{t("web.audit.archive.noMonths")}</Alert>
          ) : (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "flex-start" }}
            >
              <TextField
                select
                size="small"
                label={t("web.audit.archive.startMonth")}
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
                label={t("web.audit.archive.endMonth")}
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
                {createQuery.isPending
                  ? t("web.audit.archive.submitting")
                  : t("web.audit.archive.submit")}
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
              {t("web.audit.archive.purged", {
                years: months.retention_years,
                months: purgedMonths.join(t("web.notification.listSeparator")),
              })}
            </Typography>
          )}
        </Stack>
      </Paper>

      {!queryPublicId ? null : running || job.isLoading ? (
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1.5}>
            <CircularProgress size={28} />
            <Typography fontWeight={700}>
              {status === "running"
                ? t("web.audit.archive.running")
                : t("web.audit.archive.queued")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("web.audit.archive.runningHelp")}
            </Typography>
          </Stack>
        </Paper>
      ) : status === "failed" ? (
        <Alert severity="error">
          {archiveErrorCategories.includes(job.data?.error_category ?? "")
            ? t(`web.audit.archive.errors.${job.data?.error_category}`)
            : t("web.audit.archive.errors.generic")}
        </Alert>
      ) : status === "expired" ? (
        <Alert severity="warning">{t("web.audit.archive.expired")}</Alert>
      ) : status === "succeeded" ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {t("web.audit.archive.resultTitle", {
              from: job.data?.month_from,
              to: job.data?.month_to,
            })}
            {job.data?.scanned_bytes !== undefined &&
              t("web.audit.archive.scanned", {
                size: formatBytes(job.data.scanned_bytes),
              })}
          </Typography>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            {results.isLoading ? (
              <Stack alignItems="center" sx={{ py: 6 }}>
                <CircularProgress size={28} />
              </Stack>
            ) : items.length === 0 ? (
              <Typography sx={{ py: 6, textAlign: "center" }} fontWeight={700}>
                {t("web.audit.archive.empty")}
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
              {results.isFetchingNextPage
                ? t("web.common.loading")
                : t("web.discussion.loadMore")}
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

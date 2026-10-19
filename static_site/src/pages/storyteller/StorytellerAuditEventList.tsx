import i18n from "i18next";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useStorytellerAuditEventFilters,
  useStorytellerAuditEvents,
} from "@/apis/storyteller/audit.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerFilterChips } from "@/components/storyteller/StorytellerFilterChips.tsx";
import { StorytellerAuditAdvancedFilters } from "@/pages/storyteller/StorytellerAuditAdvancedFilters.tsx";
import {
  AuditEventDetailDrawer,
  AuditEventItems,
} from "@/pages/storyteller/StorytellerAuditEventRows.tsx";
import {
  AUDIT_HOT_RETENTION_MONTHS,
  auditErrorMessage,
  auditRangeOptions,
  emptyAuditAdvancedFilters,
  groupAuditEvents,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type {
  StorytellerAuditEvent,
  StorytellerAuditEventQuery,
} from "@/types/storyteller.ts";

const today = () => dayjs().format("YYYY-MM-DD");
// 近期範圍的起點是「現在 − N 個月」的精確時刻，自訂日期從當天 00:00 起算會落在起點之前，
// 所以最早只能選到隔天。
const earliestHotDate = () =>
  dayjs()
    .subtract(AUDIT_HOT_RETENTION_MONTHS, "month")
    .add(1, "day")
    .format("YYYY-MM-DD");

const defaultQuery: StorytellerAuditEventQuery = {
  ...emptyAuditAdvancedFilters,
  range: "24h",
  customFrom: "",
  customTo: "",
};

// 自訂日期的驗證：最早只能到近期範圍起點，更早的要改用封存查詢（回傳 "archive"）。
function customRangeError(query: StorytellerAuditEventQuery) {
  if (query.range !== "custom") return "";
  // 非元件 helper，用全域 i18next
  if (!query.customFrom || !query.customTo)
    return i18n.t("web.audit.list.errors.selectDates");
  if (query.customTo < query.customFrom)
    return i18n.t("web.audit.list.errors.endBeforeStart");
  if (query.customTo > today())
    return i18n.t("web.audit.list.errors.endAfterToday");
  if (query.customFrom < earliestHotDate()) return "archive";
  return "";
}

// StorytellerAuditEventList 是活動紀錄的近期模式：預設只有時間範圍，其他條件收在「進階篩選」；
// 依頁合併自動儲存、游標分頁與事件詳情抽屜都在這裡。
export function StorytellerAuditEventList({
  onSwitchToArchive,
}: {
  onSwitchToArchive: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(defaultQuery);
  const [selected, setSelected] = useState<StorytellerAuditEvent | null>(null);
  const [snack, setSnack] = useState("");
  const rangeError = customRangeError(query);
  const filters = useStorytellerAuditEventFilters();
  const events = useStorytellerAuditEvents(query, rangeError === "");

  useEffect(() => {
    if (events.isError) setSnack(auditErrorMessage(events.error));
  }, [events.isError, events.error]);
  useEffect(() => {
    if (filters.isError) setSnack(auditErrorMessage(filters.error));
  }, [filters.isError, filters.error]);

  const items = useMemo(
    () =>
      (events.data?.pages ?? []).flatMap((page) =>
        groupAuditEvents(page.events),
      ),
    [events.data],
  );
  const eventCount = (events.data?.pages ?? []).reduce(
    (total, page) => total + page.events.length,
    0,
  );
  const update = (patch: Partial<StorytellerAuditEventQuery>) =>
    setQuery((value) => ({ ...value, ...patch }));
  const earliestDate = earliestHotDate();

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <StorytellerFilterChips
            label={t("web.audit.list.time")}
            value={query.range}
            hideAll
            options={auditRangeOptions.map(([value, key]) => [value, t(key)])}
            onChange={(range) =>
              update({
                range: (range || "24h") as StorytellerAuditEventQuery["range"],
                // 第一次切到自訂時預設最近 7 天，使用者只要微調即可。
                customFrom:
                  query.customFrom ||
                  dayjs().subtract(6, "day").format("YYYY-MM-DD"),
                customTo: query.customTo || today(),
              })
            }
          />
          {query.range === "custom" && (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ pl: { sm: "72px" } }}
            >
              <TextField
                type="date"
                size="small"
                label={t("web.audit.list.startDate")}
                value={query.customFrom}
                onChange={(event) => update({ customFrom: event.target.value })}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: earliestDate, max: today() },
                }}
              />
              <TextField
                type="date"
                size="small"
                label={t("web.audit.list.endDate")}
                value={query.customTo}
                onChange={(event) => update({ customTo: event.target.value })}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: earliestDate, max: today() },
                }}
              />
            </Stack>
          )}
          {rangeError === "archive" ? (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={onSwitchToArchive}
                >
                  {t("web.audit.list.useArchive")}
                </Button>
              }
            >
              {t("web.audit.list.archivedNotice", {
                months: AUDIT_HOT_RETENTION_MONTHS,
              })}
            </Alert>
          ) : (
            rangeError && <Alert severity="warning">{rangeError}</Alert>
          )}
          <StorytellerAuditAdvancedFilters
            value={query}
            options={filters.data}
            onChange={update}
          />
        </Stack>
      </Paper>

      <Typography variant="body2" color="text.secondary">
        {rangeError
          ? t("web.audit.list.adjustRange")
          : events.isLoading
            ? t("web.common.loading")
            : t("web.audit.list.loadedCount", {
                count: eventCount,
                rows: items.length,
              })}
      </Typography>

      {rangeError ? null : (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          {events.isLoading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : events.isError ? (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => events.refetch()}
                >
                  {t("web.common.retry")}
                </Button>
              }
              sx={{ m: 2 }}
            >
              {t("web.audit.list.errors.load")}
            </Alert>
          ) : items.length === 0 ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2 }}>
              <Typography fontWeight={700}>
                {t("web.audit.list.empty")}
              </Typography>
              <Button size="small" onClick={() => setQuery(defaultQuery)}>
                {t("web.audit.filters.clear")}
              </Button>
            </Stack>
          ) : (
            <AuditEventItems items={items} onOpen={setSelected} />
          )}
        </Paper>
      )}

      {!rangeError && events.hasNextPage && (
        <Button
          variant="outlined"
          onClick={() => events.fetchNextPage()}
          disabled={events.isFetchingNextPage}
          sx={{ alignSelf: "center" }}
        >
          {events.isFetchingNextPage
            ? t("web.common.loading")
            : t("web.audit.list.loadEarlier")}
        </Button>
      )}

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

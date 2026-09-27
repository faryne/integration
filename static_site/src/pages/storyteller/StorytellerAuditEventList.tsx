import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  useStorytellerAuditEventFilters,
  useStorytellerAuditEvents,
} from "@/apis/storyteller/audit.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerFilterChips } from "@/components/storyteller/StorytellerFilterChips.tsx";
import {
  AuditEventDetailDrawer,
  AuditEventItems,
} from "@/pages/storyteller/StorytellerAuditEventRows.tsx";
import {
  auditCategoryLabels,
  auditErrorMessage,
  auditOutcomeLabels,
  auditRangeOptions,
  auditSourceLabels,
  groupAuditEvents,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type {
  StorytellerAuditEvent,
  StorytellerAuditEventQuery,
  StorytellerAuditScope,
} from "@/types/storyteller.ts";

const defaultQuery: StorytellerAuditEventQuery = {
  actor: "",
  category: "",
  source: "",
  outcome: "",
  credentialRef: "",
  range: "24h",
  includeLowImportance: false,
};

// StorytellerAuditEventList 是專案稽核頁與帳號活動頁共用的列表：篩選、依頁合併自動儲存、
// 游標分頁與事件詳情抽屜都在這裡，兩個頁面只負責外框與說明文字。
export function StorytellerAuditEventList({
  scope,
  projectPublicId,
}: {
  scope: StorytellerAuditScope;
  projectPublicId?: string;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [selected, setSelected] = useState<StorytellerAuditEvent | null>(null);
  const [snack, setSnack] = useState("");
  const filters = useStorytellerAuditEventFilters(scope, projectPublicId);
  const events = useStorytellerAuditEvents(scope, projectPublicId, query);

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
  const filterOptions = filters.data;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.25}>
          {(filterOptions?.actors.length ?? 0) > 1 && (
            <StorytellerFilterChips
              label="操作者"
              value={query.actor}
              onChange={(actor) => update({ actor })}
              options={(filterOptions?.actors ?? []).map((actor) => [
                actor.value,
                actor.label || actor.value,
              ])}
            />
          )}
          <StorytellerFilterChips
            label="類別"
            value={query.category}
            onChange={(category) => update({ category })}
            options={(filterOptions?.categories ?? []).map((category) => [
              category,
              auditCategoryLabels[category] ?? category,
            ])}
          />
          <StorytellerFilterChips
            label="入口"
            value={query.source}
            onChange={(source) => update({ source })}
            options={(filterOptions?.sources ?? []).map((source) => [
              source,
              auditSourceLabels[source],
            ])}
          />
          <StorytellerFilterChips
            label="結果"
            value={query.outcome}
            onChange={(outcome) => update({ outcome })}
            options={(filterOptions?.outcomes ?? []).map((outcome) => [
              outcome,
              auditOutcomeLabels[outcome],
            ])}
          />
          {(filterOptions?.credentials.length ?? 0) > 0 && (
            <StorytellerFilterChips
              label="PAT"
              value={query.credentialRef}
              onChange={(credentialRef) => update({ credentialRef })}
              options={(filterOptions?.credentials ?? []).map((credential) => [
                credential.value,
                credential.label || credential.value,
              ])}
            />
          )}
          <StorytellerFilterChips
            label="時間"
            value={query.range}
            onChange={(range) =>
              update({
                range: (range || "24h") as StorytellerAuditEventQuery["range"],
              })
            }
            options={auditRangeOptions}
            hideAll
          />
        </Stack>
      </Paper>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
      >
        <Typography variant="body2" color="text.secondary">
          {events.isLoading
            ? "載入中…"
            : `已載入 ${eventCount} 筆（合併顯示 ${items.length} 列）`}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={query.includeLowImportance || query.category !== ""}
              disabled={query.category !== ""}
              onChange={(event) =>
                update({ includeLowImportance: event.target.checked })
              }
            />
          }
          label={
            <Typography variant="body2">
              顯示讀取與收藏等低重要度事件
            </Typography>
          }
        />
      </Stack>

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
                重試
              </Button>
            }
            sx={{ m: 2 }}
          >
            稽核紀錄載入失敗。
          </Alert>
        ) : items.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 2 }}>
            <Typography fontWeight={700}>這段時間沒有符合條件的紀錄</Typography>
            <Button size="small" onClick={() => setQuery(defaultQuery)}>
              清除篩選
            </Button>
          </Stack>
        ) : (
          <AuditEventItems items={items} onOpen={setSelected} />
        )}
      </Paper>

      {events.hasNextPage && (
        <Button
          variant="outlined"
          onClick={() => events.fetchNextPage()}
          disabled={events.isFetchingNextPage}
          sx={{ alignSelf: "center" }}
        >
          {events.isFetchingNextPage ? "載入中…" : "載入更早的紀錄"}
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

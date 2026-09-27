import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Drawer,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import {
  useStorytellerAuditEventFilters,
  useStorytellerAuditEvents,
} from "@/apis/storyteller/audit.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerFilterChips } from "@/components/storyteller/StorytellerFilterChips.tsx";
import { StorytellerAuditEventDetail } from "@/pages/storyteller/StorytellerAuditEventDetail.tsx";
import {
  auditActionLabel,
  auditActorLabel,
  auditCategoryLabels,
  auditOutcomeColors,
  auditOutcomeLabels,
  auditRangeOptions,
  auditSourceLabels,
  auditTargetLabel,
  formatAuditTime,
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

function auditErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (message) return message;
  }
  return "稽核紀錄載入失敗，請稍後再試。";
}

function EventRow({
  event,
  onOpen,
  nested,
}: {
  event: StorytellerAuditEvent;
  onOpen: (event: StorytellerAuditEvent) => void;
  nested?: boolean;
}) {
  const target = auditTargetLabel(event);
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen(event)}
      sx={{
        display: "flex",
        gap: 2,
        width: "100%",
        textAlign: "left",
        border: 0,
        borderTop: nested ? 0 : 1,
        borderColor: "divider",
        bgcolor: "transparent",
        color: "inherit",
        cursor: "pointer",
        px: 2,
        py: nested ? 1 : 1.5,
        pl: nested ? 7 : 2,
        font: "inherit",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: 76, flexShrink: 0, pt: 0.25 }}
      >
        {formatAuditTime(event.occurred_at)}
      </Typography>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
          <Box component="span" fontWeight={800}>
            {auditActorLabel(event)}
          </Box>{" "}
          {auditActionLabel(event.action)}
          {target && (
            <Box component="span" fontWeight={700}>
              {" "}
              {target}
            </Box>
          )}
        </Typography>
        {!nested && (
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 0.75 }}
          >
            <Chip
              size="small"
              variant="outlined"
              label={auditSourceLabels[event.source]}
            />
            {event.credential && (
              <Chip
                size="small"
                variant="outlined"
                color="warning"
                label={event.credential.label}
              />
            )}
            <Chip
              size="small"
              color={auditOutcomeColors[event.outcome]}
              label={auditOutcomeLabels[event.outcome]}
            />
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function AutosaveGroupRow({
  events,
  onOpen,
}: {
  events: StorytellerAuditEvent[];
  onOpen: (event: StorytellerAuditEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = events[0];
  return (
    <Box sx={{ borderTop: 1, borderColor: "divider" }}>
      <Box
        component="button"
        type="button"
        onClick={() => setExpanded((value) => !value)}
        sx={{
          display: "flex",
          gap: 2,
          width: "100%",
          textAlign: "left",
          border: 0,
          bgcolor: "transparent",
          color: "inherit",
          cursor: "pointer",
          px: 2,
          py: 1.5,
          font: "inherit",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ width: 76, flexShrink: 0, pt: 0.25 }}
        >
          {formatAuditTime(latest.occurred_at)}
        </Typography>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
            <Box component="span" fontWeight={800}>
              {auditActorLabel(latest)}
            </Box>{" "}
            {auditActionLabel(latest.action)}
            <Box component="span" fontWeight={700}>
              {" "}
              {auditTargetLabel(latest)}
            </Box>
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 0.75 }}
          >
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${events.length} 次自動儲存`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={auditSourceLabels[latest.source]}
            />
            {latest.credential && (
              <Chip
                size="small"
                variant="outlined"
                color="warning"
                label={latest.credential.label}
              />
            )}
          </Stack>
        </Box>
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ pb: 1 }}>
          {events.map((event) => (
            <EventRow
              key={event.event_id}
              event={event}
              onOpen={onOpen}
              nested
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

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
          <Box sx={{ mt: "-1px" }}>
            {items.map((item) =>
              item.kind === "group" ? (
                <AutosaveGroupRow
                  key={item.events[0].event_id}
                  events={item.events}
                  onOpen={setSelected}
                />
              ) : (
                <EventRow
                  key={item.event.event_id}
                  event={item.event}
                  onOpen={setSelected}
                />
              ),
            )}
          </Box>
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

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 2.5 } }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="overline" color="primary.main" fontWeight={800}>
            事件詳情
          </Typography>
          <IconButton
            aria-label="關閉事件詳情"
            onClick={() => setSelected(null)}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        {selected && <StorytellerAuditEventDetail event={selected} />}
      </Drawer>

      <CustomSnackbar
        open={Boolean(snack)}
        message={snack}
        severity="error"
        onClose={() => setSnack("")}
      />
    </Stack>
  );
}

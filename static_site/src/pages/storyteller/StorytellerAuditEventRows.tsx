import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Chip,
  Collapse,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { StorytellerAuditEventDetail } from "@/pages/storyteller/StorytellerAuditEventDetail.tsx";
import {
  auditActionLabel,
  auditActorLabel,
  auditOutcomeColors,
  auditOutcomeLabels,
  auditSourceLabels,
  auditTargetLabel,
  formatAuditTime,
  type AuditListItem,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type { StorytellerAuditEvent } from "@/types/storyteller.ts";

// 稽核事件的列表列與詳情抽屜；近期列表與封存查詢結果共用，兩邊長得一模一樣。
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

export function AuditEventItems({
  items,
  onOpen,
}: {
  items: AuditListItem[];
  onOpen: (event: StorytellerAuditEvent) => void;
}) {
  return (
    <Box sx={{ mt: "-1px" }}>
      {items.map((item) =>
        item.kind === "group" ? (
          <AutosaveGroupRow
            key={item.events[0].event_id}
            events={item.events}
            onOpen={onOpen}
          />
        ) : (
          <EventRow
            key={item.event.event_id}
            event={item.event}
            onOpen={onOpen}
          />
        ),
      )}
    </Box>
  );
}

export function AuditEventDetailDrawer({
  event,
  onClose,
}: {
  event: StorytellerAuditEvent | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(event)}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 2.5 } }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="overline" color="primary.main" fontWeight={800}>
          事件詳情
        </Typography>
        <IconButton aria-label="關閉事件詳情" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      {event && <StorytellerAuditEventDetail event={event} />}
    </Drawer>
  );
}

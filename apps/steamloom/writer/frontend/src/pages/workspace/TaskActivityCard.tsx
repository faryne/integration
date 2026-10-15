import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Box, Collapse, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentLoginCard } from "@writer/pages/workspace/AgentLoginCard.tsx";
import { agentActivityLabel } from "@writer/pages/workspace/agentActivity.ts";
import type { Workspace } from "@writer/lib/backend.ts";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

const failedTypes = new Set(["task.failed", "task.tool.failed", "apply.failed"]);
const attentionTypes = new Set(["apply.conflict", "apply.interrupted"]);
const completedTypes = new Set(["task.completed", "apply.completed"]);

function fallbackLoginCommands(agentID: string, events: ChatLine[]) {
  const failure = [...events].reverse().find((event) => event.type === "task.failed");
  const lower = failure?.text.toLowerCase() ?? "";
  if (!lower.includes("failed to authenticate") && !lower.includes("oauth session expired") && !lower.includes("invalid or expired credentials") && !lower.includes("request carried no credential") && !lower.includes("authentication required") && !lower.includes("unauthorized (401)") && !failure?.text.includes("登入已過期") && !failure?.text.includes("未登入")) return [];
  return { claude: ["claude auth login"], codex: ["codex login"], grok: ["grok login"] }[agentID] ?? [];
}

function eventLabel(event: ChatLine, workspace: Workspace, t: (key: string, values?: Record<string, string>) => string) {
  const tool = agentActivityLabel(event.tool_name || event.text, event.tool_target, workspace, t);
  if (event.type === "task.tool.started") return t("workspace.chat.activity.toolStarted", { tool });
  if (event.type === "task.tool.completed") return t("workspace.chat.activity.toolCompleted", { tool });
  if (event.type === "task.tool.failed") return t("workspace.chat.activity.toolFailed", { tool });
  if (event.type === "apply.completed" && event.text) return event.text;
  const key = {
    "task.queued": "queued",
    "task.started": "started",
    "task.completed": "completed",
    "task.failed": "failed",
    "task.canceled": "canceled",
    "apply.started": "applyStarted",
    "apply.completed": "applyCompleted",
    "apply.failed": "applyFailed",
    "apply.conflict": "applyConflict",
    "apply.interrupted": "applyInterrupted",
  }[event.type ?? ""];
  return key ? t(`workspace.chat.activity.${key}`) : event.text;
}

// 同一次 tool call 完成後以 completed event 取代 started event，避免每個動作重複顯示兩行。
function compactToolEvents(events: ChatLine[]) {
  const timeline: ChatLine[] = [];
  const pending = new Map<string, number[]>();
  for (const event of events) {
    const key = `${event.tool_name ?? ""}:${event.tool_target ?? ""}`;
    if (event.type === "task.tool.started") {
      pending.set(key, [...(pending.get(key) ?? []), timeline.length]);
      timeline.push(event);
    } else if ((event.type === "task.tool.completed" || event.type === "task.tool.failed") && pending.get(key)?.length) {
      const positions = pending.get(key)!;
      timeline[positions.shift()!] = event;
    } else {
      timeline.push(event);
    }
  }
  return timeline;
}

export function TaskActivityCard({ agentID, events, workspace }: { agentID: string; events: ChatLine[]; workspace: Workspace }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const last = events[events.length - 1];
  const failed = events.some((event) => failedTypes.has(event.type ?? ""));
  const attention = events.some((event) => attentionTypes.has(event.type ?? ""));
  const completed = events.some((event) => completedTypes.has(event.type ?? ""));
  const writerApply = events.some((event) => event.type?.startsWith("apply."));
  const canceled = last?.type === "task.canceled";
  const commands = [...events].reverse().find((event) => event.action === "agent.login" && event.commands?.length)?.commands ?? fallbackLoginCommands(agentID, events);
  const timeline = compactToolEvents(events);

  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: "action.hover" }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {failed ? <ErrorOutlineIcon color="error" sx={{ fontSize: 18 }} /> : attention ? <WarningAmberOutlinedIcon color="warning" sx={{ fontSize: 18 }} /> : completed ? <CheckCircleOutlineIcon color="success" sx={{ fontSize: 18 }} /> : canceled ? <CancelOutlinedIcon color="disabled" sx={{ fontSize: 18 }} /> : <RadioButtonCheckedIcon color="primary" sx={{ fontSize: 18 }} />}
        <Typography fontWeight={700} sx={{ flex: 1, fontSize: 13 }}>
          {writerApply
            ? t(`workspace.chat.activity.${failed ? "writerFailedTitle" : attention ? "writerAttentionTitle" : completed ? "writerCompletedTitle" : "writerRunningTitle"}`)
            : failed ? t("workspace.chat.activity.failedTitle") : attention ? t("workspace.chat.activity.attentionTitle") : completed ? t("workspace.chat.activity.completedTitle") : canceled ? t("workspace.chat.activity.canceledTitle") : t("workspace.chat.activity.runningTitle")}
        </Typography>
        <IconButton size="small" aria-label={t(expanded ? "workspace.chat.activity.collapse" : "workspace.chat.activity.expand")} onClick={() => setExpanded((value) => !value)}>
          <ExpandMoreIcon sx={{ fontSize: 19, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 120ms" }} />
        </IconButton>
      </Stack>
      <Collapse in={expanded}>
        <Stack spacing={0.75} sx={{ mt: 0.75, ml: 0.5, pl: 1.25, borderLeft: 1, borderColor: "divider" }}>
          {timeline.map((event, index) => (
            <Box key={event.event_id ?? `${event.type}:${index}`}>
              <Typography color={failedTypes.has(event.type ?? "") ? "error.main" : attentionTypes.has(event.type ?? "") ? "warning.main" : "text.secondary"} sx={{ fontSize: 12.5 }}>
                {eventLabel(event, workspace, t)}
              </Typography>
              {(failedTypes.has(event.type ?? "") || attentionTypes.has(event.type ?? "")) && event.text && <Typography sx={{ mt: 0.25, fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{event.text}</Typography>}
            </Box>
          ))}
        </Stack>
        {commands.length > 0 && <AgentLoginCard commands={commands} />}
      </Collapse>
    </Paper>
  );
}

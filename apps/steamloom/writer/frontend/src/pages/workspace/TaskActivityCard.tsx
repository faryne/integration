import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Box, Button, Collapse, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentLoginCard } from "@writer/pages/workspace/AgentLoginCard.tsx";
import { activityEventLabel, activityEventTone } from "@writer/pages/workspace/chatEventRegistry.ts";
import type { Workspace } from "@writer/lib/backend.ts";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

function fallbackLoginCommands(agentID: string, events: ChatLine[]) {
  const failure = [...events].reverse().find((event) => event.type === "task.failed");
  const lower = failure?.text.toLowerCase() ?? "";
  if (!lower.includes("failed to authenticate") && !lower.includes("oauth session expired") && !lower.includes("invalid or expired credentials") && !lower.includes("request carried no credential") && !lower.includes("authentication required") && !lower.includes("unauthorized (401)") && !failure?.text.includes("登入已過期") && !failure?.text.includes("未登入")) return [];
  return {
    claude: ["claude auth login"],
    codex: ["codex login"],
    grok: ["grok login"],
    gemini: ["gemini"],
    antigravity: ["agy"],
  }[agentID] ?? [];
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

export function TaskActivityCard({ agentID, events, workspace, onViewRawOutput }: { agentID: string; events: ChatLine[]; workspace: Workspace; onViewRawOutput: (eventID: string) => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const last = events[events.length - 1];
  // 終局事件決定卡片狀態；例如作者確認已套用後，不應再被前面的 interrupted 維持成警告。
  const tone = last ? activityEventTone(last) : "running";
  const failed = tone === "failed";
  const attention = tone === "attention";
  const completed = tone === "completed";
  const writerApply = events.some((event) => event.type?.startsWith("apply."));
  const canceled = tone === "canceled";
  const loginEvent = [...events].reverse().find((event) => (event.action === "agent.login" || event.action === "mcp.login") && event.commands?.length);
  const commands = loginEvent?.commands ?? fallbackLoginCommands(agentID, events);
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
              <Typography color={activityEventTone(event) === "failed" ? "error.main" : activityEventTone(event) === "attention" ? "warning.main" : "text.secondary"} sx={{ fontSize: 12.5 }}>
                {activityEventLabel(event, workspace, t)}
              </Typography>
              {(activityEventTone(event) === "failed" || activityEventTone(event) === "attention") && event.text && !event.type?.startsWith("apply.item.") && <Typography sx={{ mt: 0.25, fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{event.text}</Typography>}
              {/* 提案無法使用時保存了完整原文，作者可自行取回草稿 */}
              {event.type === "proposal.invalid" && event.event_id && (
                <Button size="small" onClick={() => onViewRawOutput(event.event_id!)} sx={{ mt: 0.25, px: 0.5, minWidth: 0, fontSize: 12 }}>{t("workspace.chat.activity.viewRawOutput")}</Button>
              )}
            </Box>
          ))}
        </Stack>
        {commands.length > 0 && <AgentLoginCard commands={commands} kind={loginEvent?.action === "mcp.login" ? "mcp" : "agent"} />}
      </Collapse>
    </Paper>
  );
}

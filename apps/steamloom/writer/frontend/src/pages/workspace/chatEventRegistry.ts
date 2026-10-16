import type { Workspace } from "@writer/lib/backend.ts";
import { agentActivityLabel } from "@writer/pages/workspace/agentActivity.ts";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

type Translate = (key: string, values?: Record<string, string>) => string;
type EventTone = "failed" | "attention" | "completed" | "canceled" | "running";

const labels: Record<string, string> = {
  "task.queued": "queued",
  "task.started": "started",
  "task.progress": "progress",
  "task.completed": "completed",
  "task.failed": "failed",
  "task.canceled": "canceled",
  "apply.queued": "applyQueued",
  "apply.started": "applyStarted",
  "apply.completed": "applyCompleted",
  "apply.failed": "applyFailed",
  "apply.conflict": "applyConflict",
  "apply.interrupted": "applyInterrupted",
  "apply.verified": "applyVerified",
};

const toolTypes = new Set(["task.tool.started", "task.tool.completed", "task.tool.failed"]);
const itemTypes = new Set(["apply.item.started", "apply.item.completed", "apply.item.failed"]);

// 所有會收進執行紀錄卡的事件集中登記；新增 backend event 時不會散落在多個元件判斷。
export const activityEventTypes = new Set([...Object.keys(labels), ...toolTypes, ...itemTypes]);
const standaloneEventTypes = new Set(["message.user", "message.agent", "message.agent.partial", "system", "proposal.ready", "proposal.approved", "proposal.rejected"]);

export function knownPersistedEvent(type?: string) {
  return !type || activityEventTypes.has(type) || standaloneEventTypes.has(type);
}

export function activityEventLabel(event: ChatLine, workspace: Workspace, t: Translate) {
  if (itemTypes.has(event.type ?? "")) return event.text;
  if (toolTypes.has(event.type ?? "")) {
    const tool = agentActivityLabel(event.tool_name || event.text, event.tool_target, workspace, t);
    const key = event.type === "task.tool.started" ? "toolStarted" : event.type === "task.tool.completed" ? "toolCompleted" : "toolFailed";
    return t(`workspace.chat.activity.${key}`, { tool });
  }
  if ((event.type === "apply.completed" || event.type === "apply.verified") && event.text) return event.text;
  const key = labels[event.type ?? ""];
  return key ? t(`workspace.chat.activity.${key}`) : t("workspace.chat.activity.unknown", { type: event.type || "—" });
}

export function activityEventTone(event: ChatLine): EventTone {
  if (event.type === "task.canceled") return "canceled";
  if (event.type === "task.failed" || event.type === "task.tool.failed" || event.type === "apply.failed" || event.type === "apply.item.failed") return "failed";
  if (event.type === "apply.conflict" || event.type === "apply.interrupted") return "attention";
  if (event.type === "task.completed" || event.type === "apply.completed" || event.type === "apply.verified") return "completed";
  return "running";
}

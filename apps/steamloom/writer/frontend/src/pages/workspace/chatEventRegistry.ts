import type { Workspace } from "@writer/lib/backend.ts";
import { agentActivityLabel } from "@writer/pages/workspace/agentActivity.ts";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

type Translate = (key: string, values?: Record<string, unknown>) => string;
type EventTone = "failed" | "attention" | "completed" | "canceled" | "running";

const labels: Record<string, string> = {
  "task.queued": "queued",
  "task.started": "started",
  "task.progress": "progress",
  "task.completed": "completed",
  "task.failed": "failed",
  "task.canceled": "canceled",
  "proposal.invalid": "proposalInvalid",
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
  if (itemTypes.has(event.type ?? "")) {
    const operation = operationLabel(event, t);
    if (operation && event.current && event.total) {
      const state = event.type === "apply.item.started" ? "started" : event.type === "apply.item.completed" ? "completed" : event.detail ? "failedDetail" : "failed";
      return t(`workspace.chat.activity.operation.${state}`, { operation, current: event.current, total: event.total, detail: event.detail });
    }
    return event.text;
  }
  if (toolTypes.has(event.type ?? "")) {
    const tool = agentActivityLabel(event.tool_name || event.text, event.tool_target, workspace, t);
    const key = event.type === "task.tool.started" ? "toolStarted" : event.type === "task.tool.completed" ? "toolCompleted" : "toolFailed";
    return t(`workspace.chat.activity.${key}`, { tool });
  }
  if (event.type === "apply.completed" && event.count) return t("workspace.chat.activity.applyCompletedCount", { count: event.count });
  if (event.type === "apply.completed") return t("workspace.chat.activity.applyCompleted");
  const key = labels[event.type ?? ""];
  return key ? t(`workspace.chat.activity.${key}`) : t("workspace.chat.activity.unknown", { type: event.type || "—" });
}

export function decisionEventLabel(event: ChatLine, t: Translate) {
  const operations = event.operations?.length ? event.operations : event.operation_type ? [{ proposal_type: event.operation_type, kind: event.operation_kind, title: event.operation_title, count: event.count }] : [];
  if (!operations.length) return event.text;
  if (event.type === "proposal.approved" && operations.length === 1 && operations[0].proposal_type === "media.brief") {
    return t("workspace.chat.activity.decision.approvedMedia", { title: operations[0].title, count: operations[0].count });
  }
  if (event.type === "proposal.approved" && operations.every((operation) => operation.proposal_type === "asset.upload")) {
    const items = operations.map((operation) => decisionItemLabel(operation, t)).filter(Boolean).join(t("workspace.chat.activity.decision.separator"));
    const count = event.count || operations.reduce((total, operation) => total + (operation.count || 1), 0);
    return operations.length === 1
      ? t("workspace.chat.activity.decision.approvedAssets", { title: operations[0].title, count })
      : t("workspace.chat.activity.decision.approvedAssetsMany", { items, count });
  }
  const items = operations.map((operation) => decisionItemLabel(operation, t)).filter(Boolean);
  if (!items.length) return event.text;
  const rejected = event.type === "proposal.rejected";
  const key = `${rejected ? "rejected" : "approved"}${items.length > 1 ? "Many" : ""}`;
  return t(`workspace.chat.activity.decision.${key}`, { item: items[0], items: items.join(t("workspace.chat.activity.decision.separator")), count: items.length });
}

const operationKeys: Record<string, string> = {
  "document.create:story": "createStory",
  "document.create:lore": "createLore",
  "document.replace:story": "replaceStory",
  "document.replace:lore": "replaceLore",
  "document.patch:story": "patchStory",
  "document.patch:lore": "patchLore",
  "chapter.append:story": "appendChapter",
  "chapter.replace:story": "replaceChapter",
  "asset.upload:asset": "uploadImage",
  "media.brief:media": "generateMedia",
  "image_story.create:story": "createImageStory",
  "image_story.update:story": "updateImageStory",
};

function operationLabel(event: ChatLine, t: Translate) {
  const key = operationKeys[`${event.operation_type}:${event.operation_kind}`];
  return key && event.operation_title ? t(`workspace.chat.activity.operation.actions.${key}`, { title: event.operation_title }) : "";
}

function decisionItemLabel(operation: { kind?: string; title?: string }, t: Translate) {
  const key = { story: "story", lore: "lore", asset: "asset", media: "media" }[operation.kind ?? ""];
  return key && operation.title ? t(`workspace.chat.activity.decision.items.${key}`, { title: operation.title }) : "";
}

export function activityEventTone(event: ChatLine): EventTone {
  if (event.type === "task.canceled") return "canceled";
  if (event.type === "task.failed" || event.type === "task.tool.failed" || event.type === "apply.failed" || event.type === "apply.item.failed") return "failed";
  if (event.type === "apply.conflict" || event.type === "apply.interrupted" || event.type === "proposal.invalid") return "attention";
  if (event.type === "task.completed" || event.type === "apply.completed" || event.type === "apply.verified") return "completed";
  return "running";
}

export function activityEventDetail(event: ChatLine, t: Translate) {
  if (event.action === "writer.apply.interrupted") return t("workspace.chat.activity.applyInterruptedDetail");
  if (event.action === "worker.media.interrupted") return t("workspace.chat.activity.mediaInterruptedDetail");
  return event.detail || event.text;
}

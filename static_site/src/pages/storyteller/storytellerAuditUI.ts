import axios from "axios";
import dayjs from "dayjs";
import i18n from "i18next";
import type {
  StorytellerAuditAdvancedFilterValues,
  StorytellerAuditEvent,
  StorytellerAuditOutcome,
  StorytellerAuditSource,
} from "@/types/storyteller.ts";

// 稽核紀錄的文案放在翻譯檔 web.audit.*：action 字串是後端 registry 的穩定 key，
// 不直接拆 "." 組文案，沒對應到的就顯示原始 action，避免新 action 上線時畫面空白。
// action 本身含 "."（且 auth.login 與 auth.login.failed 會在巢狀 key 裡衝突），
// 所以翻譯 key 一律把 "." 換成 "_"。這些都是非元件 helper，用全域 i18next。
const t = i18n.t.bind(i18n);

export const auditCategoryLabel = (category: string) =>
  t(`web.audit.categories.${category}`, { defaultValue: category });

export const auditSourceLabel = (source: StorytellerAuditSource) =>
  t(`web.audit.sources.${source}`);

export const auditOutcomeLabel = (outcome: StorytellerAuditOutcome) =>
  t(`web.audit.outcomes.${outcome}`);

export const auditOutcomeColors: Record<
  StorytellerAuditOutcome,
  "success" | "warning" | "error"
> = { success: "success", denied: "warning", failed: "error" };

// [值, 翻譯 key]；呈現端用 t() 取字
export const auditRangeOptions: Array<[string, string]> = [
  ["24h", "web.audit.ranges.24h"],
  ["7d", "web.audit.ranges.7d"],
  ["30d", "web.audit.ranges.30d"],
  ["custom", "web.audit.ranges.custom"],
];

export function auditActionLabel(action: string) {
  return t(`web.audit.actions.${action.replaceAll(".", "_")}`, {
    defaultValue: action,
  });
}

export function auditActorLabel(event: StorytellerAuditEvent) {
  if (event.actor.type === "system") return t("web.audit.actor.system");
  return event.actor.display_name || t("web.audit.actor.unknown");
}

export function auditTargetLabel(event: StorytellerAuditEvent) {
  if (!event.target) return "";
  return event.target.name || event.target.public_id;
}

export function formatAuditTime(value: string) {
  const time = dayjs(value);
  return time.isSame(dayjs(), "day")
    ? time.format("HH:mm")
    : time.format("MM/DD HH:mm");
}

export function formatAuditTimestamp(value: string) {
  return dayjs(value).format("YYYY-MM-DD HH:mm:ss.SSS");
}

// 連續自動儲存合併的時間窗（使用者確認為 5 分鐘）。
export const AUDIT_AUTOSAVE_GROUP_WINDOW_MS = 5 * 60 * 1000;

// 會被自動儲存大量觸發的 action；作品與設定的編輯器都有自動儲存。
const autosaveActions = new Set(["story.update", "lore.update"]);

export type AuditListItem =
  | { kind: "event"; event: StorytellerAuditEvent }
  | { kind: "group"; events: StorytellerAuditEvent[] };

function sameAutosaveStream(
  a: StorytellerAuditEvent,
  b: StorytellerAuditEvent,
) {
  return (
    autosaveActions.has(a.action) &&
    a.action === b.action &&
    a.outcome === "success" &&
    b.outcome === "success" &&
    a.target?.public_id === b.target?.public_id &&
    a.actor.type === b.actor.type &&
    a.actor.display_name === b.actor.display_name &&
    a.source === b.source &&
    a.credential?.public_id === b.credential?.public_id
  );
}

// groupAuditEvents 只在單一頁內合併相鄰的自動儲存事件（事件已依時間新到舊排序），
// 不跨頁合併，避免「載入更多」後前面已顯示的列突然變形；拒絕與失敗事件永遠單獨顯示。
export function groupAuditEvents(events: StorytellerAuditEvent[]) {
  const items: AuditListItem[] = [];
  let current: StorytellerAuditEvent[] = [];
  const flush = () => {
    if (current.length === 1) items.push({ kind: "event", event: current[0] });
    if (current.length > 1) items.push({ kind: "group", events: current });
    current = [];
  };
  for (const event of events) {
    const previous = current[current.length - 1];
    if (
      previous &&
      sameAutosaveStream(previous, event) &&
      dayjs(previous.occurred_at).diff(dayjs(event.occurred_at)) <=
        AUDIT_AUTOSAVE_GROUP_WINDOW_MS
    ) {
      current.push(event);
      continue;
    }
    flush();
    current = [event];
  }
  flush();
  return items;
}

// API 錯誤訊息優先用後端給的中文 message（例如「請改用封存查詢」），沒有才用通用文案。
export function auditErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (message) return message;
  }
  return t("web.audit.errors.load");
}

// 近期查詢的保存月數，對應後端 AUDIT_HOT_RETENTION_MONTHS 的預設值；前端只用來提早提示，
// 實際限制以後端為準（超過會回「請改用封存查詢」）。
export const AUDIT_HOT_RETENTION_MONTHS = 3;

export const emptyAuditAdvancedFilters: StorytellerAuditAdvancedFilterValues = {
  projectPublicId: "",
  category: "",
  source: "",
  outcome: "",
  credentialRef: "",
  includeLowImportance: false,
};

// 進階篩選收合時要顯示「目前套用了幾個條件」，避免使用者忘了還有條件在作用。
export function countActiveAuditFilters(
  values: StorytellerAuditAdvancedFilterValues,
) {
  return [
    values.projectPublicId,
    values.category,
    values.source,
    values.outcome,
    values.credentialRef,
    values.includeLowImportance,
  ].filter(Boolean).length;
}

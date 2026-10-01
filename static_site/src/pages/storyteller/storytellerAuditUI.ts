import axios from "axios";
import dayjs from "dayjs";
import type {
  StorytellerAuditAdvancedFilterValues,
  StorytellerAuditEvent,
  StorytellerAuditOutcome,
  StorytellerAuditSource,
} from "@/types/storyteller.ts";

// 稽核紀錄的中文文案集中在這裡：action 字串是後端 registry 的穩定 key，
// 不直接拆 "." 組文案，沒對應到的就顯示原始 action，避免新 action 上線時畫面空白。
export const auditActionLabels: Record<string, string> = {
  "project.create": "建立專案",
  "project.update": "更新專案",
  "project.delete": "刪除專案",
  "project.visibility.change": "變更專案公開範圍",
  "project.share_token.regenerate": "重新產生分享連結",
  "story.create": "建立作品",
  "story.update": "更新作品",
  "story.delete": "刪除作品",
  "story.move": "搬移作品",
  "story.reorder": "調整作品順序",
  "story.revert": "還原作品版本",
  "story_chapter.replace": "改寫作品章節",
  "story_chapter.insert": "插入作品章節",
  "story_chapter.delete": "刪除作品章節",
  "volume.create": "建立冊",
  "volume.update": "更新冊",
  "volume.delete": "刪除冊",
  "volume.reorder": "調整冊順序",
  "lore.create": "建立設定",
  "lore.update": "更新設定",
  "lore.delete": "刪除設定",
  "lore.move": "搬移設定",
  "lore.revert": "還原設定版本",
  "lore_collection.create": "建立設定集",
  "lore_collection.update": "更新設定集",
  "lore_collection.delete": "刪除設定集",
  "lore_chapter.replace": "改寫設定章節",
  "lore_chapter.insert": "插入設定章節",
  "lore_chapter.delete": "刪除設定章節",
  "asset.upload.confirm": "上傳資產",
  "asset.replace.confirm": "更換資產檔案",
  "asset.update": "更新資產",
  "asset.move": "搬移資產",
  "asset.delete": "刪除資產",
  "asset_collection.create": "建立資產集",
  "asset_collection.update": "更新資產集",
  "asset_collection.delete": "刪除資產集",
  "agent.run": "執行 AI 助理",
  "agent.resend": "重送 AI 助理",
  "agent.proposal.apply": "套用 AI 提案",
  "agent.proposal.reject": "拒絕 AI 提案",
  "agent.proposal.reset": "重設 AI 提案",
  "memory.create": "新增梭梭記憶",
  "memory.update": "更新梭梭記憶",
  "memory.delete": "刪除梭梭記憶",
  "memory.confirm": "確認梭梭記憶",
  "memory.draft.generate": "整理記憶草稿",
  "memory.draft.retry": "重新整理記憶草稿",
  "memory.draft.discard": "捨棄記憶草稿",
  "auth.login": "登入",
  "auth.login.failed": "登入失敗",
  "auth.logout": "登出",
  "auth.pat.denied": "Personal Access Token 驗證被拒絕",
  "auth.oauth.denied": "OAuth Token 驗證被拒絕",
  "auth.oauth.refresh.denied": "OAuth Token 換發被拒絕",
  "pat.create": "建立 Personal Access Token",
  "pat.revoke": "撤銷 Personal Access Token",
  "oauth.authorize": "同意 OAuth 授權",
  "oauth.deny": "拒絕 OAuth 授權",
  "oauth.grant.create": "應用程式完成 OAuth 連線",
  "oauth.token.refresh": "OAuth Token 換發",
  "oauth.revoke": "撤銷 OAuth 授權",
  "provider_key.create": "新增 API key",
  "provider_key.update": "更新 API key",
  "provider_key.delete": "刪除 API key",
  "provider_key.test": "測試 API key 連線",
  "profile.update": "更新個人資料",
  "profile.delete": "刪除個人資料",
  "author_profile.create": "建立作者頁",
  "author_profile.update": "更新作者頁",
  "author_profile.delete": "刪除作者頁",
  "agent_skill.create": "建立 Skill",
  "agent_skill.update": "更新 Skill",
  "agent_skill.delete": "刪除 Skill",
  "favorite.add": "追蹤",
  "favorite.remove": "取消追蹤",
  "favorite.visibility.update": "變更追蹤清單可見度",
  "ranking.update": "更新排名",
  "ranking.delete": "移除排名",
  "bookmark.add": "加入閱讀書籤",
  "bookmark.remove": "移除閱讀書籤",
  "bookmark.create": "建立寫作書籤",
  "bookmark.update": "更新寫作書籤",
  "bookmark.delete": "刪除寫作書籤",
  "project.list": "讀取專案列表",
  "project.read": "讀取專案",
  "story.list": "讀取作品列表",
  "story.read": "讀取作品",
  "story.version.list": "讀取作品版本列表",
  "story_chapter.list": "讀取作品章節列表",
  "story_chapter.read": "讀取作品章節",
  "volume.list": "讀取冊列表",
  "lore.list": "讀取設定列表",
  "lore.read": "讀取設定",
  "lore.version.list": "讀取設定版本列表",
  "lore_collection.list": "讀取設定集列表",
  "lore_chapter.list": "讀取設定章節列表",
  "lore_chapter.read": "讀取設定章節",
  "asset.list": "讀取資產列表",
  "asset.read": "讀取資產",
  "asset_collection.list": "讀取資產集列表",
  "memory.list": "讀取梭梭記憶",
  "memory.search": "搜尋梭梭記憶",
  "author_profile.list": "讀取作者頁列表",
  "audit.archive_query.create": "查詢封存稽核紀錄",
  "system.audit.export": "匯出稽核封存",
  "system.audit.mysql_purge": "清除已封存的近期稽核資料",
  "system.audit.archive_purge": "刪除超過保存期限的封存",
};

export const auditCategoryLabels: Record<string, string> = {
  project: "專案",
  story: "作品",
  lore: "設定",
  asset: "資產",
  agent: "AI 助理",
  memory: "梭梭記憶",
  auth: "登入",
  credential: "憑證",
  profile: "個人資料",
  social: "收藏與追蹤",
  read: "讀取",
  audit: "稽核查詢",
  system: "系統",
};

export const auditSourceLabels: Record<StorytellerAuditSource, string> = {
  web: "網頁",
  mcp: "MCP",
  api: "API",
  cron: "排程",
};

export const auditOutcomeLabels: Record<StorytellerAuditOutcome, string> = {
  success: "成功",
  denied: "拒絕",
  failed: "失敗",
};

export const auditOutcomeColors: Record<
  StorytellerAuditOutcome,
  "success" | "warning" | "error"
> = { success: "success", denied: "warning", failed: "error" };

export const auditRangeOptions: Array<[string, string]> = [
  ["24h", "最近 24 小時"],
  ["7d", "最近 7 天"],
  ["30d", "最近 30 天"],
  ["custom", "自訂"],
];

export function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action;
}

export function auditActorLabel(event: StorytellerAuditEvent) {
  if (event.actor.type === "system") return "系統";
  return event.actor.display_name || "未識別的使用者";
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
  return "稽核紀錄載入失敗，請稍後再試。";
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

import axios from "axios";
import {
  storytellerReaderPath,
  storytellerSearchResultPath,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type { StorytellerNotification } from "@/types/storytellerNotification.ts";

// 通知列表／popover／內容頁共用的文案與格式化；DB 只存快照，文字一律在這裡組。

export type NotificationTone = "story" | "project" | "security" | "general";

export interface NotificationHeadline {
  tone: NotificationTone;
  // 粗體顯示的主詞（筆名或應用程式名稱），可能沒有
  actor?: string;
  text: string;
  sub?: string;
}

const firstStoryLabel = (n: StorytellerNotification) => {
  const first = n.payload.stories?.[0];
  if (!first) return "";
  return first.volume_title
    ? `${first.volume_title}・${first.title}`
    : first.title;
};

export function notificationHeadline(
  n: StorytellerNotification,
): NotificationHeadline {
  const p = n.payload;
  const authors = (p.authors ?? []).join("、");
  switch (n.kind) {
    case "story.published": {
      const total = p.story_total ?? p.stories?.length ?? 0;
      return {
        tone: "story",
        actor: authors,
        text: ` 的《${p.project_name}》更新了${total > 1 ? ` ${total} 話` : ""}`,
        sub: total > 1 ? `從 ${firstStoryLabel(n)} 開始` : firstStoryLabel(n),
      };
    }
    case "project.published":
      return {
        tone: "project",
        actor: authors,
        text: ` 發表了新作品《${p.project_name}》`,
        sub: p.description,
      };
    case "security.oauth.authorized":
      return {
        tone: "security",
        actor: p.client_name,
        text: " 已取得你的帳號授權",
        sub: deviceLabel(n),
      };
    case "security.pat.created":
      return {
        tone: "security",
        text: `建立了新的 Personal Access Token「${p.label}」`,
        sub: [p.token_prefix && `${p.token_prefix}…`, deviceLabel(n)]
          .filter(Boolean)
          .join(" · "),
      };
    default:
      // 沒有專屬文案的類型（含前端還不認識的新類型）一律用通用欄位
      return {
        tone: n.kind.startsWith("security.") ? "security" : "general",
        text: p.title || "新通知",
        sub: p.body,
      };
  }
}

// 通用 link 只放行站內路徑，避免通知被拿來導到外部網站
export const notificationSafeLink = (link?: string) =>
  link?.startsWith("/") && !link.startsWith("//") ? link : null;

const sourceLabels: Record<string, string> = {
  web: "網頁",
  mcp: "MCP",
  api: "API",
};

export const notificationSourceLabel = (source?: string) =>
  (source && sourceLabels[source]) || source || "—";

// 依序比對，先中的優先（Edge／Chrome 的 UA 都含 Safari，所以 Safari 放最後）
const osPatterns: [string, RegExp][] = [
  ["iPadOS", /iPad/],
  ["iOS", /iPhone/],
  ["Android", /Android/],
  ["Windows", /Windows/],
  ["macOS", /Mac OS X|Macintosh/],
  ["Linux", /Linux/],
];
const browserPatterns: [string, RegExp][] = [
  ["Edge", /Edg\/(\d+)/],
  ["Firefox", /Firefox\/(\d+)/],
  ["Chrome", /Chrome\/(\d+)/],
  ["Safari", /Version\/(\d+).*Safari/],
];

// summarizeUserAgent 只取作業系統與瀏覽器主版號，完整字串留在內容頁的提示裡。
export function summarizeUserAgent(ua?: string) {
  if (!ua) return "";
  const os = osPatterns.find(([, re]) => re.test(ua))?.[0];
  const browser = browserPatterns
    .map(([name, re]) => ua.match(re)?.[1] && `${name} ${ua.match(re)![1]}`)
    .find(Boolean);
  return [os, browser].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

const deviceLabel = (n: StorytellerNotification) =>
  [summarizeUserAgent(n.payload.user_agent), n.payload.ip]
    .filter(Boolean)
    .join(" · ");

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (iso: string) =>
  Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY_MS);

// 通知頁的日期分組
export function notificationGroupLabel(iso: string) {
  const days = daysAgo(iso);
  return days <= 0
    ? "今天"
    : days <= 7
      ? "這一週"
      : days <= 30
        ? "這個月"
        : "更早";
}

const hhmm = (d: Date) =>
  d.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

// 列表上的相對時間：今天只顯示時間，昨天加「昨天」，一個月內顯示天數，更早顯示日期
export function notificationTimeLabel(iso: string) {
  const days = daysAgo(iso);
  const date = new Date(iso);
  if (days <= 0) return hhmm(date);
  if (days === 1) return `昨天 ${hhmm(date)}`;
  if (days <= 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-TW");
}

export const notificationFullTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", { hour12: false });

// 剩 14 天內就要被清除時才提醒
export const NOTIFICATION_EXPIRING_WITHIN_DAYS = 14;

export function notificationDaysLeft(n: StorytellerNotification) {
  if (!n.expires_at) return null;
  return Math.max(
    0,
    Math.ceil((new Date(n.expires_at).getTime() - Date.now()) / DAY_MS),
  );
}

export const notificationPath = (publicId?: string) =>
  steamloomPath(publicId ? `my/notifications/${publicId}` : "my/notifications");

export function notificationProjectPath(n: StorytellerNotification) {
  const { project_public_id, project_slug } = n.payload;
  return project_public_id
    ? storytellerReaderPath({
        public_id: project_public_id,
        slug: project_slug ?? "",
      })
    : null;
}

export function notificationStoryPath(
  n: StorytellerNotification,
  storyPublicId: string,
) {
  return storytellerSearchResultPath({
    project_public_id: n.payload.project_public_id ?? "",
    project_slug: n.payload.project_slug ?? "",
    story_public_id: storyPublicId,
  });
}

export function notificationErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (message) return message;
  }
  return fallback;
}

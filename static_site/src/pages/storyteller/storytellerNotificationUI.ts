import {
  storytellerReaderPath,
  storytellerSearchResultPath,
} from "@/data/storyteller.ts";
import { useStorytellerNotificationKinds } from "@/apis/storyteller.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { removedByStaffText } from "@/helpers/moderationReasons.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type {
  StorytellerNotification,
  StorytellerNotificationKindDefinition,
  StorytellerNotificationView,
} from "@/types/storytellerNotification.ts";

// 通知列表／popover／內容頁共用的文案與格式化；DB 只存快照，文字一律在這裡組。

const knownViews: StorytellerNotificationView[] = [
  "stories",
  "project",
  "security",
  "generic",
  "follower",
  "favorite",
  "posted",
  "comment",
];

// 前端只依「呈現方式」分支，不寫死 kind；註冊表查不到或 view 不認識的一律當 generic
export function notificationView(
  definition?: StorytellerNotificationKindDefinition,
): StorytellerNotificationView {
  const view = definition?.view as StorytellerNotificationView;
  return knownViews.includes(view) ? view : "generic";
}

// 依 kind 查註冊表；整個 session 共用同一份快取
export function useNotificationKindDefinition(kind: string) {
  const { data } = useStorytellerNotificationKinds();
  return data?.find((definition) => definition.kind === kind);
}

// 這則通知的呈現方式；註冊表還沒載入時先當 generic
export const useNotificationView = (n: StorytellerNotification) =>
  notificationView(useNotificationKindDefinition(n.kind));

export interface NotificationHeadline {
  // 粗體顯示的主詞（筆名），可能沒有
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
  view: StorytellerNotificationView,
): NotificationHeadline {
  const p = n.payload;
  const authors = (p.authors ?? []).join("、");
  switch (view) {
    case "stories": {
      const total = p.story_total ?? p.stories?.length ?? 0;
      return {
        actor: authors,
        text: ` 的《${p.project_name}》更新了${total > 1 ? ` ${total} 話` : ""}`,
        sub: total > 1 ? `從 ${firstStoryLabel(n)} 開始` : firstStoryLabel(n),
      };
    }
    case "project":
      return {
        actor: authors,
        text: ` 發表了新作品《${p.project_name}》`,
        sub: p.description,
      };
    case "follower":
      return {
        actor: notificationActorName(n),
        text: p.target_pen_name
          ? ` 追蹤了你的筆名 ${p.target_pen_name}`
          : " 追蹤了你",
      };
    case "favorite":
      return {
        actor: notificationActorName(n),
        text: ` 收藏了你的作品《${p.project_name}》`,
        sub:
          (p.authors ?? []).length > 0 ? `署名：${p.authors!.join("、")}` : "",
      };
    case "posted": {
      const count = p.posts?.length ?? 0;
      return {
        actor: notificationActorName(n),
        text: count > 1 ? ` 發了 ${count} 則新動態` : " 發了新動態",
        sub: p.deleted
          ? deletedText("動態", p.delete_reason)
          : (p.posts?.[0]?.excerpt ?? p.body),
      };
    }
    case "comment":
      return {
        actor: notificationActorName(n),
        text:
          n.kind === "post.replied"
            ? " 回覆了你的留言"
            : p.target_pen_name
              ? ` 留言了你的筆名 ${p.target_pen_name} 的貼文`
              : " 留言了你的貼文",
        sub: p.deleted
          ? deletedText("留言", p.delete_reason)
          : `「${p.comment_excerpt ?? ""}」`,
      };
    case "security":
      return {
        text: p.title,
        sub: [p.token_prefix && `${p.token_prefix}…`, deviceLabel(n)]
          .filter(Boolean)
          .join(" · "),
      };
    default:
      return { text: p.title, sub: p.body };
  }
}

// 追蹤／收藏通知的追蹤者名稱；身份已刪除時後端不帶 actor
export const notificationActorName = (n: StorytellerNotification) =>
  n.payload.actor?.pen_name ?? "已不存在的使用者";

// 通用 link：站內路徑走 router，http(s) 外部網址另開分頁；
// 其他協定（javascript: 等）不顯示按鈕，避免點了直接執行程式碼
export function notificationLink(link?: string) {
  if (!link) return null;
  if (link.startsWith("/") && !link.startsWith("//")) {
    return { href: link, external: false };
  }
  return /^https?:\/\//i.test(link) ? { href: link, external: true } : null;
}

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

// 實作共用 helpers/apiError.ts；保留這個名字讓既有通知元件不用改 import
export const notificationErrorMessage = apiErrorMessage;

// 已刪除的貼文／留言：本人刪的「（留言已刪除）」，站方移除的補列原因
function deletedText(kind: string, reason?: string) {
  return reason
    ? `（${kind}${removedByStaffText(reason)}）`
    : `（${kind}已刪除）`;
}

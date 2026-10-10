import { storytellerReaderPath } from "@/data/storyteller.ts";
import {
  steamloomCreatorPath,
  steamloomPostPath,
} from "@/helpers/steamloom.ts";
import {
  readerDiscussionsPath,
  readerLorePath,
  readerStoryPath,
} from "@/helpers/storytellerReaderPaths.ts";
import type {
  AdminReportStatus,
  AdminReportTarget,
  AdminTargetFilter,
  AdminTargetType,
} from "@/types/storytellerAdmin.ts";

// 後台檢舉頁共用的文字與連結：後端只給結構化欄位，名稱、所在位置、前台連結都在這裡組。

export const adminStatusTabs: [AdminReportStatus, string][] = [
  ["pending", "待處理"],
  ["resolved", "已結案"],
  ["dismissed", "已駁回"],
];

export const adminTargetFilters: [AdminTargetFilter | "", string][] = [
  ["", "全部"],
  ["project", "作品"],
  ["story", "故事"],
  ["lore", "設定"],
  ["author", "創作者"],
  ["author_post", "動態"],
  ["discussion_thread", "討論串"],
  ["comment", "留言"],
];

export const adminTargetTypeLabels: Record<AdminTargetType, string> = {
  project: "作品",
  story: "故事",
  lore: "設定",
  user: "創作者",
  author_profile: "創作者",
  author_post: "動態",
  discussion_thread: "討論串",
  comment: "留言",
};

const ownerOrMissing = (target: AdminReportTarget) =>
  target.owner_name || "已不存在的使用者";

// adminTargetName：列表標題／詳情頁標題
export function adminTargetName(target: AdminReportTarget) {
  if (target.type === "comment") return `${ownerOrMissing(target)} 的留言`;
  if (target.type === "author_post") return `${ownerOrMissing(target)} 的動態`;
  return target.title || target.public_id;
}

// adminTargetPlace：所在位置（留言在哪個討論串／誰的動態、故事屬於哪部作品）
export function adminTargetPlace(target: AdminReportTarget) {
  const project = target.context_project && `《${target.context_project}》`;
  switch (target.type) {
    case "comment":
      return target.context_thread
        ? `${project ?? ""}討論串「${target.context_thread}」`
        : target.link.pen_name && `${target.link.pen_name} 的動態`;
    case "discussion_thread":
    case "story":
    case "lore":
      return project;
    case "user":
      return "帳號本人";
    case "author_profile":
      return `額外筆名 · 所屬帳號 ${target.account_pen_name || "—"}`;
    default:
      return undefined;
  }
}

// adminTargetHref：前台連結（已刪除的對象前台會 404，仍給連結方便確認）
export function adminTargetHref(target: AdminReportTarget) {
  const link = target.link;
  const base =
    link.project_public_id &&
    storytellerReaderPath({
      public_id: link.project_public_id,
      slug: link.project_slug ?? "",
    });
  switch (target.type) {
    case "comment":
      if (base && link.thread_public_id)
        return `${readerDiscussionsPath(base)}?thread=${link.thread_public_id}`;
      return link.pen_name && link.post_public_id
        ? steamloomPostPath(
            link.pen_name,
            link.post_public_id,
            link.comment_public_id,
          )
        : undefined;
    case "author_post":
      return link.pen_name && link.post_public_id
        ? steamloomPostPath(link.pen_name, link.post_public_id)
        : undefined;
    case "discussion_thread":
      return (
        base && `${readerDiscussionsPath(base)}?thread=${link.thread_public_id}`
      );
    case "story":
      return (
        base &&
        link.story_public_id &&
        readerStoryPath(base, link.story_public_id)
      );
    case "lore":
      return (
        base && link.lore_public_id && readerLorePath(base, link.lore_public_id)
      );
    case "project":
      return base || undefined;
    default:
      return link.pen_name ? steamloomCreatorPath(link.pen_name) : undefined;
  }
}

// adminRemoveAction：移除動作的種類，對應翻譯 moderation.admin.action.<key>／dialog.confirm.<key>
export function adminRemoveAction(type: AdminTargetType) {
  if (type === "user") return "ban";
  if (type === "author_profile") return "removeProfile";
  return "remove";
}

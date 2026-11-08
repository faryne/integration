import type { FollowKind, JoyuFollowItem } from "@/apis/av/joyu_me.ts";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import { joyuPath } from "@/helpers/joyu.ts";

// 追蹤類型的顯示名稱與排序（我的追蹤頁的類型篩選依這個順序）
export const FOLLOW_KIND_LABELS: Record<FollowKind, string> = {
  actress: "女優",
  search: "搜尋條件",
  maker: "發售商",
  label: "品牌",
  series: "系列",
  director: "監督",
  tag: "標籤",
};
export const FOLLOW_KINDS = Object.keys(FOLLOW_KIND_LABELS) as FollowKind[];

/** 追蹤名稱的連結：女優進女優頁，其他進影片搜尋（帶同樣的條件） */
export const followItemLink = (item: JoyuFollowItem) =>
  item.kind === "actress" && item.actress
    ? actressPagePath(item.actress.name, item.actress)
    : joyuPath(`video?${item.search_query}`);

import type { DiscussionAnchor } from "@/types/storytellerDiscussion.ts";

// 閱讀頁交給討論元件的資訊：哪部作品、分享 token、防劇透判斷與錨點的顯示名稱／連結。
// 由 pages/storyteller/readerDiscussion.ts 依閱讀頁現有的資料組出來，討論元件不直接碰閱讀頁的狀態。
export interface ReaderDiscussionContext {
  projectPublicId: string;
  // 不公開作品的分享 token；公開作品沒有
  share?: string;
  // 討論分頁網址（分享連結也適用），複製串連結用
  discussionsPath: string;
  // 錨定的話沒讀完、或錨定的設定還鎖著（作者本人一律不擋）
  isSpoiler: (anchor: DiscussionAnchor) => boolean;
  anchorLabel: (anchor: DiscussionAnchor) => string;
  anchorHref: (anchor: DiscussionAnchor) => string | undefined;
  // 討論分頁發起討論時「關於」的候選：讀者看得到的話與設定（設定名稱已依防劇透替換）
  stories: { id: string; label: string }[];
  lores: { id: string; label: string }[];
}

// 串的分享連結：討論分頁＋自動展開該串
export const discussionThreadLink = (
  context: ReaderDiscussionContext,
  threadId: string,
) =>
  new URL(
    `${context.discussionsPath}?thread=${threadId}`,
    window.location.origin,
  ).toString();

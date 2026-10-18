import { useMemo } from "react";
import { useStorytellerLores } from "@/apis/storyteller/lore.ts";
import { useStorytellerStories } from "@/apis/storyteller/story.ts";
import type { CommentRef } from "@/pages/storyteller/wysiwygCore/commentRefs.ts";

// 註解參照指到的故事／設定。內容直接取專案的故事／設定清單（清單本來就帶已存檔的內文與更新時間），
// 參照卡、挑選器、chip 標題共用同一份 react-query 快取；Writer 經 WebApiProvider 走同一套 API。
export type CommentRefTarget = CommentRef & {
  title: string;
  content: string;
  updatedAt: string;
  isImage: boolean;
};

export const commentRefKey = (ref: CommentRef) => `${ref.kind}:${ref.publicId}`;

export function useCommentRefTargets(projectPublicId?: string) {
  const stories = useStorytellerStories(projectPublicId);
  const lores = useStorytellerLores(projectPublicId);
  const targets = useMemo(() => {
    const map = new Map<string, CommentRefTarget>();
    // 冊不是文件，不能當參照
    for (const story of stories.data ?? []) {
      if (story.is_volume) continue;
      map.set(`story:${story.public_id}`, {
        kind: "story",
        publicId: story.public_id,
        title: story.title,
        content: story.latest_content,
        updatedAt: story.updated_at,
        isImage: story.content_type === "image",
      });
    }
    for (const lore of lores.data ?? []) {
      map.set(`lore:${lore.public_id}`, {
        kind: "lore",
        publicId: lore.public_id,
        title: lore.title,
        content: lore.latest_content,
        updatedAt: lore.updated_at,
        isImage: false,
      });
    }
    return map;
  }, [stories.data, lores.data]);
  // 兩份清單都載完才能判斷「找不到＝已刪除」，載入中不要先標成已刪除
  return { targets, loaded: stories.isSuccess && lores.isSuccess };
}

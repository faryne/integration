import type { ReaderDiscussionContext } from "@/components/storyteller/discussion/discussionContext.ts";
import {
  readerDiscussionsPath,
  readerLorePath,
  readerStoryPath,
} from "@/helpers/storytellerReaderPaths.ts";
import type { DiscussionAnchor } from "@/types/storytellerDiscussion.ts";
import type { ReaderItem, ReaderLore, ReaderVolume } from "./readerModel.ts";
import type { ReaderProgress } from "./readingRecordStore.ts";

// 把閱讀頁現有的資料（話、冊、設定、閱讀進度、設定防劇透閘門）組成討論元件要的 context，
// 讓 Reader.tsx 只多一行呼叫，不再擴大（見 Reader.tsx 不再擴大的原則）。
export function buildReaderDiscussion({
  projectPublicId,
  share,
  basePath,
  isOwner,
  items,
  volumes,
  lores,
  storyProgress,
  loreLocked,
  loreTitle,
}: {
  projectPublicId: string;
  share?: string;
  basePath: string;
  isOwner: boolean;
  items: ReaderItem[];
  volumes: ReaderVolume[];
  lores: ReaderLore[];
  storyProgress: (storyId: string) => ReaderProgress | undefined;
  loreLocked: (lore: ReaderLore) => boolean;
  loreTitle: (lore: ReaderLore) => string;
}): ReaderDiscussionContext {
  const volumeTitle = (item: ReaderItem) =>
    volumes.find((volume) => volume.id === item.parentId)?.title;
  const storyLabel = (item: ReaderItem) =>
    [volumeTitle(item), item.title].filter(Boolean).join("・");
  const findLore = (id?: string) => lores.find((lore) => lore.id === id);
  return {
    projectPublicId,
    share,
    discussionsPath: readerDiscussionsPath(basePath),
    isSpoiler: (anchor: DiscussionAnchor) => {
      if (isOwner || anchor.unavailable || !anchor.public_id) return false;
      if (anchor.type === "story")
        return !storyProgress(anchor.public_id)?.completed;
      const lore = findLore(anchor.public_id);
      return lore ? loreLocked(lore) : false;
    },
    anchorLabel: (anchor: DiscussionAnchor) => {
      if (anchor.unavailable) return "已下架";
      if (anchor.type === "lore") {
        const lore = findLore(anchor.public_id);
        return lore ? loreTitle(lore) : (anchor.title ?? "");
      }
      return [anchor.volume_title, anchor.title].filter(Boolean).join("・");
    },
    anchorHref: (anchor: DiscussionAnchor) =>
      anchor.unavailable || !anchor.public_id
        ? undefined
        : anchor.type === "story"
          ? readerStoryPath(basePath, anchor.public_id)
          : readerLorePath(basePath, anchor.public_id),
    stories: items.map((item) => ({ id: item.id, label: storyLabel(item) })),
    lores: lores.map((lore) => ({ id: lore.id, label: loreTitle(lore) })),
  };
}

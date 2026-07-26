import type { StorytellerStory } from "@/types/storyteller.ts";

// sortedGroup 回傳某個 parentId（null 代表未分冊）底下的故事，依 sort 排序。
export function sortedGroup(
  stories: StorytellerStory[],
  parentId: number | null,
): StorytellerStory[] {
  return stories
    .filter((story) => story.parent_id === parentId)
    .sort((left, right) => left.sort - right.sort);
}

// flattenGroupedStories 依照工作台故事列表相同的分組順序展開成一維陣列：
// 依冊的 sort 依序列出每一冊底下的故事，未分冊故事排在最後（當作還沒收進
// 任何冊的內容）。閱讀頁的上一章／下一章導覽跟目錄編號都用這個順序，確保
// 跟工作台看到的順序一致。
export function flattenGroupedStories(
  stories: StorytellerStory[],
  volumes: StorytellerStory[],
): StorytellerStory[] {
  const orderedVolumes = [...volumes].sort(
    (left, right) => left.sort - right.sort,
  );
  return [
    ...orderedVolumes.flatMap((volume) => sortedGroup(stories, volume.id)),
    ...sortedGroup(stories, null),
  ];
}

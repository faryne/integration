import { useMemo } from "react";
import {
  usePatchStorytellerLore,
  usePatchStorytellerStory,
  useSaveStorytellerLore,
  useSaveStorytellerStory,
} from "@/apis/storyteller.ts";
import type { StorytellerLoreDependency } from "@/types/storyteller.ts";
import type {
  DocumentEditingAdapter,
  DocumentKind,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

// 依賴在草稿裡是 "story:<id>"／"lore:<id>"，轉成 API 的格式
export const loreDependencyRefs = (
  keys: string[],
): StorytellerLoreDependency[] =>
  keys.map((key) => {
    const [type, publicId] = key.split(":");
    return {
      target_type: type as StorytellerLoreDependency["target_type"],
      target_public_id: publicId,
    };
  });

// 用網站的 API hook 存故事／設定（react-query mutation，存完會 invalidate 網站的快取）。
// SteamLoom Writer 的文字文件也用這一份：axios 在 Writer 裡會經 Go 的 ApiProxy 轉發（見 Writer 的 lib/webApi.tsx）。
export function useWebDocumentAdapter(
  kind: DocumentKind,
  projectPublicId?: string,
): DocumentEditingAdapter {
  const saveStory = useSaveStorytellerStory(projectPublicId);
  const saveLore = useSaveStorytellerLore(projectPublicId);
  const patchStory = usePatchStorytellerStory(projectPublicId);
  const patchLore = usePatchStorytellerLore(projectPublicId);
  const { mutateAsync: saveStoryAsync } = saveStory;
  const { mutateAsync: saveLoreAsync } = saveLore;
  const { mutateAsync: patchStoryAsync } = patchStory;
  const { mutateAsync: patchLoreAsync } = patchLore;

  return useMemo<DocumentEditingAdapter>(
    () => ({
      save: async (draft, { trigger, publicId, baseVersionId, sort }) => {
        const base_version_id = baseVersionId ?? undefined;
        const saved =
          kind === "story"
            ? await saveStoryAsync({
                storyPublicId: publicId,
                input: {
                  title: draft.title,
                  summary: draft.summary,
                  status: draft.status,
                  sort,
                  content: draft.content,
                  parent_id: draft.groupId,
                  profile_ids: draft.profileIds,
                  save_trigger: trigger,
                  base_version_id,
                },
              })
            : await saveLoreAsync({
                lorePublicId: publicId,
                input: {
                  title: draft.title,
                  content: draft.content,
                  summary: draft.summary,
                  is_spoiler: draft.isSpoiler,
                  depends_on: loreDependencyRefs(draft.dependsOn),
                  save_trigger: trigger,
                  base_version_id,
                  // 狀態、設定集是即時 PATCH 的，已存在的設定存檔時不帶（省略＝不變更），
                  // 避免拿到過期的值蓋掉側邊列剛改的；新設定建立時才一起送
                  ...(publicId
                    ? {}
                    : { status: draft.status, collection_id: draft.groupId }),
                },
              });
        return {
          publicId: saved?.public_id,
          versionId: saved?.latest_version_id ?? null,
          updatedAt: saved?.updated_at,
          conflict: Boolean(saved?.version_conflict),
          content: saved?.latest_content,
        };
      },
      patch: async (publicId, patch) => {
        if (kind === "story") {
          await patchStoryAsync({
            storyPublicId: publicId,
            input: {
              status: patch.status,
              parent_id: patch.groupId,
              profile_ids: patch.profileIds,
            },
          });
        } else {
          await patchLoreAsync({
            lorePublicId: publicId,
            input: { status: patch.status, collection_id: patch.groupId },
          });
        }
      },
    }),
    [kind, patchLoreAsync, patchStoryAsync, saveLoreAsync, saveStoryAsync],
  );
}

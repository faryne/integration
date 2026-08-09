import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerStory,
  StorytellerStoryBookmark,
  StorytellerStoryBookmarkWithStory,
  StorytellerStoryRequest,
  StorytellerStoryVersion,
  StorytellerStoryVolumeActivity,
  StorytellerStoryVolumeRequest,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

export function useStorytellerStories(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "stories", projectPublicId, session?.user.id],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerStory[]>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useSaveStorytellerStory(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storyPublicId,
      input,
    }: {
      storyPublicId?: string;
      input: StorytellerStoryRequest;
    }) => {
      const base = `${apiBase}/storyteller/projects/${projectPublicId}/stories`;
      const url = storyPublicId ? `${base}/${storyPublicId}` : base;
      const response = storyPublicId
        ? await axios.put<CommonResponse<StorytellerStory>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          })
        : await axios.post<CommonResponse<StorytellerStory>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useDeleteStorytellerStory(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storyPublicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useStorytellerVolumes(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "volumes", projectPublicId, session?.user.id],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerStory[]>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/volumes`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

// useSaveStorytellerVolume 建立／重新命名一冊，跟 useSaveStorytellerStory 分開——
// 冊只有標題可以編輯，不會誤帶內容/摘要/狀態欄位。
export function useSaveStorytellerVolume(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      volumePublicId,
      input,
    }: {
      volumePublicId?: string;
      input: StorytellerStoryVolumeRequest;
    }) => {
      const base = `${apiBase}/storyteller/projects/${projectPublicId}/volumes`;
      const url = volumePublicId ? `${base}/${volumePublicId}` : base;
      const response = volumePublicId
        ? await axios.put<CommonResponse<StorytellerStory>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          })
        : await axios.post<CommonResponse<StorytellerStory>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

// useStorytellerVolumeActivity：目前沒有對應顯示畫面（見開發文件），先把 API 接起來，
// 之後要做冊的活動時間軸／通知功能可以直接用。
export function useStorytellerVolumeActivity(
  projectPublicId?: string,
  volumePublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "volume-activity",
      projectPublicId,
      volumePublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && volumePublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryVolumeActivity>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/volumes/${volumePublicId}/activity`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

// 帶上登入者的 encrypt key（若有），讓故事本人預覽自己私人專案裡的草稿故事時，
// 這條公開路由也能正常回傳版本資訊（見後端 optionalViewerID）。
export function usePublicStorytellerStoryLatestVersion(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "public-story-latest-version",
      projectPublicId,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(projectPublicId && storyPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerStoryVersion>>(
        `${apiBase}/storyteller/story/${projectPublicId}/stories/${storyPublicId}/latest-version`,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
      );
      return response.data.data;
    },
  });
}

export function usePublicStorytellerStoryVersions(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "public-story-versions",
      projectPublicId,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(projectPublicId && storyPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryVersion[]>
      >(
        `${apiBase}/storyteller/story/${projectPublicId}/stories/${storyPublicId}/versions`,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
      );
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerStoryVersions(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "story-versions",
      projectPublicId,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && storyPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryVersion[]>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/versions`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerProjectBookmarks(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "project-bookmarks",
      projectPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryBookmarkWithStory[]>
      >(`${apiBase}/storyteller/story/${projectPublicId}/bookmarks`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerStoryBookmarks(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "story-bookmarks",
      projectPublicId,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && storyPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryBookmark[]>
      >(
        `${apiBase}/storyteller/story/${projectPublicId}/stories/${storyPublicId}/bookmarks`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

// lineId 對文字故事是行號的字串形式，對圖片故事（話）是頁面 id；versionId 只有文字
// 書籤需要（圖片書籤不綁版本），可以省略。
interface StorytellerStoryBookmarkInput {
  lineId: string;
  versionId?: number;
}

export function useCreateStorytellerStoryBookmark(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lineId,
      versionId,
    }: StorytellerStoryBookmarkInput) => {
      const response = await axios.post<
        CommonResponse<StorytellerStoryBookmark>
      >(
        `${apiBase}/storyteller/story/${projectPublicId}/stories/${storyPublicId}/bookmarks`,
        { version_id: versionId ?? 0, line_id: lineId },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "story-bookmarks"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "project-bookmarks"],
      });
    },
  });
}

// 刪除跟建立分開設計：建立永遠是「對目前正在看的這篇作品」加書籤，storyPublicId
// 綁在 hook 建構時就固定；但書籤側欄的刪除要能刪專案裡任何一篇作品的書籤（使用者
// 在瀏覽故事 A 時，也可能想順手刪掉故事 B 底下已經失效的舊書籤），所以 storyPublicId
// 改成隨每次呼叫傳，不綁在 hook 上。
interface StorytellerStoryBookmarkDeleteInput extends StorytellerStoryBookmarkInput {
  storyPublicId: string;
}

export function useDeleteStorytellerStoryBookmark(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storyPublicId,
      lineId,
      versionId,
    }: StorytellerStoryBookmarkDeleteInput) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/story/${projectPublicId}/stories/${storyPublicId}/bookmarks`,
        {
          data: { version_id: versionId ?? 0, line_id: lineId },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "story-bookmarks"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "project-bookmarks"],
      });
    },
  });
}

export function useStorytellerStoryVersion(
  projectPublicId?: string,
  storyPublicId?: string,
  versionId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "story-version",
      projectPublicId,
      storyPublicId,
      versionId,
      session?.user.id,
    ],
    enabled: Boolean(
      session?.encrypt_key && projectPublicId && storyPublicId && versionId,
    ),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerStoryVersion>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/versions/${versionId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

export function useRevertStorytellerStoryVersion(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: number) => {
      const response = await axios.post<CommonResponse<StorytellerStory>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/versions/${versionId}/revert`,
        {},
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

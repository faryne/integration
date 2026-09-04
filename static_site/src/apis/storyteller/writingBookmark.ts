import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type { StorytellerWritingBookmark } from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

export type WritingBookmarkTarget =
  | { kind: "story"; storyPublicId: string }
  | { kind: "lore"; lorePublicId: string };

function writingBookmarkPath(
  projectPublicId: string,
  target: WritingBookmarkTarget,
) {
  const base = `${apiBase}/storyteller/projects/${projectPublicId}`;
  return target.kind === "story"
    ? `${base}/stories/${target.storyPublicId}/bookmarks`
    : `${base}/lores/${target.lorePublicId}/bookmarks`;
}

function writingBookmarkQueryKey(
  projectPublicId: string | undefined,
  target: WritingBookmarkTarget | undefined,
  userId?: number | string,
) {
  return [
    "storyteller",
    "writing-bookmarks",
    projectPublicId,
    target?.kind,
    target?.kind === "story" ? target.storyPublicId : target?.lorePublicId,
    userId,
  ] as const;
}

export function useStorytellerWritingBookmarks(
  projectPublicId?: string,
  target?: WritingBookmarkTarget,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: writingBookmarkQueryKey(
      projectPublicId,
      target,
      session?.user.id,
    ),
    enabled: Boolean(session?.encrypt_key && projectPublicId && target),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerWritingBookmark[]>
      >(writingBookmarkPath(projectPublicId!, target!), {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useCreateStorytellerWritingBookmark(
  projectPublicId?: string,
  target?: WritingBookmarkTarget,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { marker_id: string; note?: string }) => {
      const response = await axios.post<
        CommonResponse<StorytellerWritingBookmark>
      >(writingBookmarkPath(projectPublicId!, target!), input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "writing-bookmarks"],
      });
    },
  });
}

export function useUpdateStorytellerWritingBookmark(
  projectPublicId?: string,
  target?: WritingBookmarkTarget,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { marker_id: string; note?: string }) => {
      const response = await axios.put<
        CommonResponse<StorytellerWritingBookmark>
      >(writingBookmarkPath(projectPublicId!, target!), input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "writing-bookmarks"],
      });
    },
  });
}

export function useDeleteStorytellerWritingBookmark(
  projectPublicId?: string,
  target?: WritingBookmarkTarget,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (markerId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        writingBookmarkPath(projectPublicId!, target!),
        {
          headers: sessionHeaders(session!.encrypt_key),
          data: { marker_id: markerId },
        },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "writing-bookmarks"],
      });
    },
  });
}

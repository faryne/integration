import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CommonResponse, EsPagination } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerFavoriteAuthor,
  StorytellerProject,
  StorytellerProjectRanking,
  StorytellerProjectRequest,
  StorytellerProjectSearchResult,
  StorytellerUserProfile,
  StorytellerUserProfileRequest,
  StorytellerWorkSearchResult,
} from "@/types/storyteller.ts";
import {
  apiBase,
  ASSET_URL_REFRESH_INTERVAL_MS,
  sessionHeaders,
} from "./shared.ts";

export function usePublicStorytellerProjects() {
  return useQuery({
    queryKey: ["storyteller", "public-projects"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject[]>>(
        `${apiBase}/storyteller/projects/public`,
      );
      return response.data.data ?? [];
    },
  });
}

export interface StorytellerSearchParams {
  keyword?: string;
  tag?: string;
  rating?: string;
  author?: string;
}

// 全站作品搜尋，cursor-based 無限捲動載入——每次「載入更多」用上一頁回傳的
// next_cursor 接著查，不是傳統頁碼換頁（ES deep pagination 用 search_after 比較划算）。
// enabled 給搜尋頁的「依故事／依專案」Tab 切換用，沒切到的那個 tab 不用真的發request。
export function useStorytellerSearch(
  params: StorytellerSearchParams,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["storyteller", "search", params],
    enabled,
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<
        CommonResponse<EsPagination<StorytellerWorkSearchResult[]>>
      >(`${apiBase}/storyteller/search`, {
        params: {
          keyword: params.keyword || undefined,
          tag: params.tag || undefined,
          rating: params.rating || undefined,
          author: params.author || undefined,
          cursor: pageParam || undefined,
        },
      });
      return response.data.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage?.has_next ? lastPage.next_cursor : undefined,
  });
}

// 全站作品搜尋「依專案分組」版本，篩選條件跟 useStorytellerSearch 共用同一個
// StorytellerSearchParams 形狀，差別只在打的 API 路徑跟回傳資料的分組方式。
export function useStorytellerProjectSearch(
  params: StorytellerSearchParams,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["storyteller", "search-projects", params],
    enabled,
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<
        CommonResponse<EsPagination<StorytellerProjectSearchResult[]>>
      >(`${apiBase}/storyteller/search/projects`, {
        params: {
          keyword: params.keyword || undefined,
          tag: params.tag || undefined,
          rating: params.rating || undefined,
          author: params.author || undefined,
          cursor: pageParam || undefined,
        },
      });
      return response.data.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage?.has_next ? lastPage.next_cursor : undefined,
  });
}

export function usePublicUserStorytellerProjects(
  username?: string,
  page = 1,
  pageSize = 20,
) {
  return useQuery({
    queryKey: ["storyteller", "public-user-projects", username, page, pageSize],
    enabled: Boolean(username),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<{
          items: StorytellerProject[];
          total: number;
          author?: StorytellerFavoriteAuthor;
        }>
      >(`${apiBase}/storyteller/user/${encodeURIComponent(username!)}`, {
        params: { page, pageSize },
      });
      return (
        response.data.data ?? {
          items: [],
          total: 0,
        }
      );
    },
  });
}

// 帶上登入者的 encrypt key（若有）讓後端可以辨識「正在看自己頁面的作者本人」，
// 藉此在回應中夾帶隱藏中的收藏項目，讓作者能在自己的公開頁上管理它們。
export function usePublicFavoriteStorytellerProjects(username?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "public-favorite-projects",
      username,
      session?.user.id,
    ],
    enabled: Boolean(username),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject[]>>(
        `${apiBase}/storyteller/user/${encodeURIComponent(username!)}/favorites/projects`,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
      );
      return response.data.data ?? [];
    },
  });
}

export function usePublicFavoriteStorytellerAuthors(username?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "public-favorite-authors",
      username,
      session?.user.id,
    ],
    enabled: Boolean(username),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerFavoriteAuthor[]>
      >(
        `${apiBase}/storyteller/user/${encodeURIComponent(username!)}/favorites/authors`,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
      );
      return response.data.data ?? [];
    },
  });
}

export function useSaveFavoriteProjectVisibility(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hidden: boolean) => {
      const response = await axios.patch<CommonResponse<{ hidden: boolean }>>(
        `${apiBase}/storyteller/favorites/projects/${projectPublicId}/visibility`,
        { hidden },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useSaveFavoriteAuthorVisibility(authorUserId?: number) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hidden: boolean) => {
      const response = await axios.patch<CommonResponse<{ hidden: boolean }>>(
        `${apiBase}/storyteller/favorites/authors/${authorUserId}/visibility`,
        { hidden },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

// 帶上登入者的 encrypt key（若有）讓後端可以辨識「正在看自己私人/不公開連結專案的作者
// 本人」——跟 usePublicFavoriteStorytellerProjects 是同一組模式，見後端 optionalViewerID。
export function usePublicStorytellerProject(projectPath?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "public-project", projectPath, session?.user.id],
    enabled: Boolean(projectPath),
    retry: false,
    refetchInterval: ASSET_URL_REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject>>(
        `${apiBase}/storyteller/story/${encodeURIComponent(projectPath!)}`,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
      );
      return response.data.data;
    },
  });
}

export function useSharedStorytellerProject(shareToken?: string) {
  return useQuery({
    queryKey: ["storyteller", "shared-project", shareToken],
    enabled: Boolean(shareToken),
    retry: false,
    refetchInterval: ASSET_URL_REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject>>(
        `${apiBase}/storyteller/story/share/${shareToken}`,
      );
      return response.data.data;
    },
  });
}

export function useStorytellerProjects() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "projects", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject[]>>(
        `${apiBase}/storyteller/projects`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerProject(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "project", projectPublicId, session?.user.id],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject>>(
        `${apiBase}/storyteller/projects/${projectPublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

export function useSaveStorytellerProject() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      publicId,
      input,
    }: {
      publicId?: string;
      input: StorytellerProjectRequest;
    }) => {
      const url = publicId
        ? `${apiBase}/storyteller/projects/${publicId}`
        : `${apiBase}/storyteller/projects`;
      const response = publicId
        ? await axios.put<CommonResponse<StorytellerProject>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          })
        : await axios.post<CommonResponse<StorytellerProject>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useDeleteStorytellerProject() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/projects/${publicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useFavoriteStorytellerProjects() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "favorites", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject[]>>(
        `${apiBase}/storyteller/favorites`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useFavoriteStorytellerAuthors() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "favorite-authors", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerFavoriteAuthor[]>
      >(`${apiBase}/storyteller/favorites/authors`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerProjectFavorite(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "favorite", projectPublicId, session?.user.id],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<{ favorited: boolean }>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/favorite`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? { favorited: false };
    },
  });
}

export function useStorytellerAuthorFavorite(authorUserId?: number) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "author-favorite",
      authorUserId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && authorUserId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<{ favorited: boolean }>>(
        `${apiBase}/storyteller/authors/${authorUserId}/favorite`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? { favorited: false };
    },
  });
}

export function useSaveStorytellerAuthorFavorite(authorUserId?: number) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (favorited: boolean) => {
      const url = `${apiBase}/storyteller/authors/${authorUserId}/favorite`;
      const response = favorited
        ? await axios.post<CommonResponse<StorytellerFavoriteAuthor>>(
            url,
            null,
            { headers: sessionHeaders(session!.encrypt_key) },
          )
        : await axios.delete<CommonResponse<{ deleted: boolean }>>(url, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useSaveStorytellerProjectFavorite(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (favorited: boolean) => {
      const url = `${apiBase}/storyteller/projects/${projectPublicId}/favorite`;
      const response = favorited
        ? await axios.post<CommonResponse<StorytellerProject>>(url, null, {
            headers: sessionHeaders(session!.encrypt_key),
          })
        : await axios.delete<CommonResponse<{ deleted: boolean }>>(url, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useStorytellerProjectRanking(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "ranking", projectPublicId, session?.user.id],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerProjectRanking>
      >(`${apiBase}/storyteller/projects/${projectPublicId}/ranking`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? { ranking: null };
    },
  });
}

export function useSaveStorytellerProjectRanking(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ranking: number | null) => {
      const url = `${apiBase}/storyteller/projects/${projectPublicId}/ranking`;
      const response =
        ranking === null
          ? await axios.delete<CommonResponse<{ deleted: boolean }>>(url, {
              headers: sessionHeaders(session!.encrypt_key),
            })
          : await axios.put<CommonResponse<StorytellerProjectRanking>>(
              url,
              { ranking },
              { headers: sessionHeaders(session!.encrypt_key) },
            );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useStorytellerUserProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "user", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerUserProfile>>(
        `${apiBase}/storyteller/user`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

export function useSaveStorytellerUserProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StorytellerUserProfileRequest) => {
      const response = await axios.put<CommonResponse<StorytellerUserProfile>>(
        `${apiBase}/storyteller/user`,
        input,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

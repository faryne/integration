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
  StorytellerAgent,
  StorytellerAgentPromptVersion,
  StorytellerAgentProviderModels,
  StorytellerAgentRunRequest,
  StorytellerAgentRunResponse,
  StorytellerAgentRequest,
  StorytellerAgentUsageLogPage,
  StorytellerAgentUsageSummaryRow,
  StorytellerFavoriteAuthor,
  StorytellerImagePageUploadOutput,
  StorytellerLore,
  StorytellerLoreRequest,
  StorytellerLoreVersion,
  StorytellerPersonalAccessToken,
  StorytellerPersonalAccessTokenCreated,
  StorytellerPersonalAccessTokenRequest,
  StorytellerProject,
  StorytellerProjectRanking,
  StorytellerProjectRequest,
  StorytellerProviderAPIKey,
  StorytellerProviderAPIKeyRequest,
  StorytellerProviderAPIKeyUpdateRequest,
  StorytellerStory,
  StorytellerStoryBookmark,
  StorytellerStoryBookmarkWithStory,
  StorytellerStoryChatMessagePage,
  StorytellerStoryImagePage,
  StorytellerStoryRequest,
  StorytellerStoryVersion,
  StorytellerStoryVolumeActivity,
  StorytellerStoryVolumeRequest,
  StorytellerUserProfile,
  StorytellerUserProfileRequest,
  StorytellerWorkSearchResult,
} from "@/types/storyteller.ts";

const apiBase = import.meta.env.VITE_API_BASE;

function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}

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
export function useStorytellerSearch(params: StorytellerSearchParams) {
  return useInfiniteQuery({
    queryKey: ["storyteller", "search", params],
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

export function useStorytellerAgents() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "agents", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerAgent[]>>(
        `${apiBase}/storyteller/agents`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerAgentProviderModels() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "agent-provider-models", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAgentProviderModels[]>
      >(`${apiBase}/storyteller/agents/provider-models`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerProviderAPIKeys() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "provider-apikeys", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerProviderAPIKey[]>
      >(`${apiBase}/storyteller/provider-apikeys`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useCreateStorytellerProviderAPIKey() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StorytellerProviderAPIKeyRequest) => {
      const response = await axios.post<
        CommonResponse<StorytellerProviderAPIKey>
      >(`${apiBase}/storyteller/provider-apikeys`, input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "provider-apikeys"],
      });
    },
  });
}

export function useDeleteStorytellerProviderAPIKey() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/provider-apikeys/${id}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "provider-apikeys"],
      });
    },
  });
}

export function useUpdateStorytellerProviderAPIKey() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number;
      input: StorytellerProviderAPIKeyUpdateRequest;
    }) => {
      const response = await axios.put<
        CommonResponse<StorytellerProviderAPIKey>
      >(`${apiBase}/storyteller/provider-apikeys/${id}`, input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "provider-apikeys"],
      });
    },
  });
}

export function useStorytellerPersonalAccessTokens() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "personal-access-tokens", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerPersonalAccessToken[]>
      >(`${apiBase}/storyteller/personal-access-tokens`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useCreateStorytellerPersonalAccessToken() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StorytellerPersonalAccessTokenRequest) => {
      const response = await axios.post<
        CommonResponse<StorytellerPersonalAccessTokenCreated>
      >(`${apiBase}/storyteller/personal-access-tokens`, input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "personal-access-tokens"],
      });
    },
  });
}

export function useDeleteStorytellerPersonalAccessToken() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/personal-access-tokens/${id}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "personal-access-tokens"],
      });
    },
  });
}

export function useTestStorytellerProviderAPIKey() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      modelName,
    }: {
      id: number;
      modelName?: string;
    }) => {
      const response = await axios.post<CommonResponse<{ ok: boolean }>>(
        `${apiBase}/storyteller/provider-apikeys/${id}/test-connection`,
        { model_name: modelName ?? "" },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    // 不論成功或失敗，後端都會把測試結果寫回 DB，這裡重新整理清單讓畫面顯示最新的持久化狀態
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["storyteller", "provider-apikeys"],
      });
    },
  });
}

export function useStorytellerAgentUsageSummary(month: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "usage-summary", session?.user.id, month],
    enabled: Boolean(session?.encrypt_key) && Boolean(month),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAgentUsageSummaryRow[]>
      >(`${apiBase}/storyteller/usage/summary`, {
        params: { month },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerAgentUsageLogs(
  providerApiKeyId: number,
  agentId: number,
  month: string,
  page: number,
  perPage = 20,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "usage-logs",
      session?.user.id,
      providerApiKeyId,
      agentId,
      month,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key) && Boolean(month),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAgentUsageLogPage>
      >(`${apiBase}/storyteller/usage/logs`, {
        params: {
          provider_apikey_id: providerApiKeyId,
          agent_id: agentId,
          month,
          page,
          per_page: perPage,
        },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return (
        response.data.data ?? { items: [], total: 0, page, per_page: perPage }
      );
    },
  });
}

export function useSaveStorytellerAgent() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: number;
      input: StorytellerAgentRequest;
    }) => {
      const url = id
        ? `${apiBase}/storyteller/agents/${id}`
        : `${apiBase}/storyteller/agents`;
      const response = id
        ? await axios.put<CommonResponse<StorytellerAgent>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          })
        : await axios.post<CommonResponse<StorytellerAgent>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useStorytellerAgentPromptVersions(agentId?: number) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "agent-prompt-versions",
      agentId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && agentId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAgentPromptVersion[]>
      >(`${apiBase}/storyteller/agents/${agentId}/versions`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerAgentPromptVersion(
  agentId?: number,
  versionId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "agent-prompt-version",
      agentId,
      versionId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && agentId && versionId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAgentPromptVersion>
      >(`${apiBase}/storyteller/agents/${agentId}/versions/${versionId}`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
  });
}

export function useDeleteStorytellerAgent() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/agents/${id}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useRunStorytellerAgent(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      input,
    }: {
      agentId: number;
      input: StorytellerAgentRunRequest;
    }) => {
      const response = await axios.post<
        CommonResponse<StorytellerAgentRunResponse>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/agents/${agentId}/run`,
        input,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    // 等訊息列表重新抓取完成後 mutation 才算結束，
    // 讓編輯器清除樂觀訊息時正式紀錄已經就位，避免訊息短暫消失
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["storyteller", "story-chat-messages"],
      });
    },
  });
}

export function useRunStorytellerLoreAgent(
  projectPublicId?: string,
  lorePublicId?: string,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      input,
    }: {
      agentId: number;
      input: StorytellerAgentRunRequest;
    }) => {
      const response = await axios.post<
        CommonResponse<StorytellerAgentRunResponse>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/agents/${agentId}/run`,
        input,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    // 等訊息列表重新抓取完成後 mutation 才算結束，
    // 讓編輯器清除樂觀訊息時正式紀錄已經就位，避免訊息短暫消失
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["storyteller", "lore-chat-messages"],
      });
    },
  });
}

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

// usePresignStorytellerImageUpload 拿 count 組可以直接 PUT 上傳到 S3 的網址，不綁定到
// 特定的話——上傳完成後直接用 useSaveStorytellerStory 建立一筆 content_type=image 的故事，
// content 帶上這些 key 組成的 JSON（見 StorytellerStoryImagePage）。
export function usePresignStorytellerImageUpload(projectPublicId?: string) {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (contentTypes: string[]) => {
      const response = await axios.post<
        CommonResponse<StorytellerImagePageUploadOutput[]>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/image-pages/presign`,
        { content_types: contentTypes },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

// useStorytellerImageStoryPages 是作者管理頁／預覽用的版本，不限公開狀態。
export function useStorytellerImageStoryPages(
  projectPublicId?: string,
  storyPublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "image-story-pages",
      projectPublicId,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && storyPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryImagePage[]>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/image-pages`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

// usePublicStorytellerImageStoryPages／useSharedStorytellerImageStoryPages 是閱讀頁用的
// 版本，只有已發布的話才讀得到，不需要登入——跟 usePublicStorytellerProject／
// useSharedStorytellerProject 是同一組模式。
export function usePublicStorytellerImageStoryPages(
  projectPath?: string,
  storyPublicId?: string,
) {
  return useQuery({
    queryKey: [
      "storyteller",
      "public-image-story-pages",
      projectPath,
      storyPublicId,
    ],
    enabled: Boolean(projectPath && storyPublicId),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryImagePage[]>
      >(
        `${apiBase}/storyteller/story/${encodeURIComponent(projectPath!)}/stories/${storyPublicId}/image-pages`,
      );
      return response.data.data ?? [];
    },
  });
}

export function useSharedStorytellerImageStoryPages(
  shareToken?: string,
  storyPublicId?: string,
) {
  return useQuery({
    queryKey: [
      "storyteller",
      "shared-image-story-pages",
      shareToken,
      storyPublicId,
    ],
    enabled: Boolean(shareToken && storyPublicId),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryImagePage[]>
      >(
        `${apiBase}/storyteller/story/share/${shareToken}/stories/${storyPublicId}/image-pages`,
      );
      return response.data.data ?? [];
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

export function useDeleteStorytellerStoryBookmark(
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

// 依「頁碼」累加載入的對話紀錄：第 1 頁是最新訊息，往後翻頁載入更早的訊息，
// 供 IM 常見的「載入更早的訊息」互動使用（而非數字換頁，換頁會整批替換畫面上的訊息）。
export function useStorytellerStoryChatMessages(
  projectPublicId?: string,
  storyPublicId?: string,
  perPage = 10,
) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      "storyteller",
      "story-chat-messages",
      projectPublicId,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && storyPublicId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryChatMessagePage>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/chat-messages`,
        {
          params: { page: pageParam, per_page: perPage },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return (
        response.data.data ?? {
          items: [],
          total: 0,
          page: pageParam,
          per_page: perPage,
        }
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.per_page < lastPage.total
        ? lastPage.page + 1
        : undefined,
  });
}

export function useStorytellerLoreChatMessages(
  projectPublicId?: string,
  lorePublicId?: string,
  perPage = 10,
) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      "storyteller",
      "lore-chat-messages",
      projectPublicId,
      lorePublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && lorePublicId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryChatMessagePage>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/chat-messages`,
        {
          params: { page: pageParam, per_page: perPage },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return (
        response.data.data ?? {
          items: [],
          total: 0,
          page: pageParam,
          per_page: perPage,
        }
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.per_page < lastPage.total
        ? lastPage.page + 1
        : undefined,
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

export function useStorytellerLores(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "lores", projectPublicId, session?.user.id],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerLore[]>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

// 分頁版本，只給工作台的設定集列表用——LoreEditor／StoryEditor／LoreDiffCompare
// 那些要完整清單（@lore: 引用選單、版本比較）的地方繼續用 useStorytellerLores。
export function useStorytellerLoresPage(
  projectPublicId?: string,
  page = 1,
  pageSize = 20,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "lores-page",
      projectPublicId,
      page,
      pageSize,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<{
          lores: StorytellerLore[];
          total_count: number;
          page: number;
          page_size: number;
        }>
      >(`${apiBase}/storyteller/projects/${projectPublicId}/lores/page`, {
        params: { page, per_page: pageSize },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return (
        response.data.data ?? {
          lores: [],
          total_count: 0,
          page,
          page_size: pageSize,
        }
      );
    },
  });
}

export function useSaveStorytellerLore(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lorePublicId,
      input,
    }: {
      lorePublicId?: string;
      input: StorytellerLoreRequest;
    }) => {
      const base = `${apiBase}/storyteller/projects/${projectPublicId}/lores`;
      const url = lorePublicId ? `${base}/${lorePublicId}` : base;
      const response = lorePublicId
        ? await axios.put<CommonResponse<StorytellerLore>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          })
        : await axios.post<CommonResponse<StorytellerLore>>(url, input, {
            headers: sessionHeaders(session!.encrypt_key),
          });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useDeleteStorytellerLore(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lorePublicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useStorytellerLoreVersions(
  projectPublicId?: string,
  lorePublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "lore-versions",
      projectPublicId,
      lorePublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && lorePublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerLoreVersion[]>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/versions`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useStorytellerLoreVersion(
  projectPublicId?: string,
  lorePublicId?: string,
  versionId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "lore-version",
      projectPublicId,
      lorePublicId,
      versionId,
      session?.user.id,
    ],
    enabled: Boolean(
      session?.encrypt_key && projectPublicId && lorePublicId && versionId,
    ),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerLoreVersion>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/versions/${versionId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

export function useRevertStorytellerLoreVersion(
  projectPublicId?: string,
  lorePublicId?: string,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: number) => {
      const response = await axios.post<CommonResponse<StorytellerLore>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/versions/${versionId}/revert`,
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

import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
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
  StorytellerPersonalAccessToken,
  StorytellerPersonalAccessTokenCreated,
  StorytellerPersonalAccessTokenRequest,
  StorytellerProviderAPIKey,
  StorytellerProviderAPIKeyRequest,
  StorytellerProviderAPIKeyUpdateRequest,
  StorytellerStoryChatMessagePage,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

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

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
  StorytellerAgenticChatResponse,
  StorytellerAgenticReferenceContentResponse,
  StorytellerAgenticReplyReferenceRequest,
  StorytellerAgenticQueryResponse,
  StorytellerAgentPromptVersion,
  StorytellerAgentProviderModels,
  StorytellerAgentSubmitInput,
  StorytellerAgentSubmitRequest,
  StorytellerAgentRequest,
  StorytellerAgentUsageLogPage,
  StorytellerAgentUsageSummaryRow,
  StorytellerPersonalAccessToken,
  StorytellerPersonalAccessTokenCreated,
  StorytellerPersonalAccessTokenRequest,
  StorytellerProviderAPIKey,
  StorytellerProviderAPIKeyModel,
  StorytellerProviderAPIKeyModelRequest,
  StorytellerProviderAPIKeyRequest,
  StorytellerProviderAPIKeyUpdateRequest,
  StorytellerStoryChatMessagePage,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

const agenticQueryTimeoutMs = 490000;

// 依 chat id 撈一筆對話目前的狀態與訊息（輪詢用）；不需要知道它掛在哪個故事／設定集底下。
export async function fetchStorytellerAgenticChat({
  chatId,
  encryptKey,
}: {
  chatId: number;
  encryptKey: string;
}) {
  const response = await axios.get<
    CommonResponse<StorytellerAgenticChatResponse>
  >(`${apiBase}/storyteller/agent-chats/${chatId}`, {
    headers: sessionHeaders(encryptKey),
  });
  return response.data.data;
}

export function useStorytellerAgenticReferenceContent(
  targetKind: "story" | "lore",
  projectPublicId?: string,
  targetPublicId?: string,
) {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (reference: StorytellerAgenticReplyReferenceRequest) => {
      if (reference.kind === "proposal") {
        const response = await axios.get<
          CommonResponse<StorytellerAgenticReferenceContentResponse>
        >(
          `${apiBase}/storyteller/projects/${projectPublicId}/agentic-proposals/${reference.proposal_public_id}/reference-content`,
          { headers: sessionHeaders(session!.encrypt_key) },
        );
        return response.data.data ?? { content: "" };
      }
      const section = targetKind === "lore" ? "lores" : "stories";
      const response = await axios.get<
        CommonResponse<StorytellerAgenticReferenceContentResponse>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/${section}/${targetPublicId}/chat-messages/${reference.message_id}/reference-content`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? { content: "" };
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

function providerAPIKeyModelsQueryKey(
  userID: number | undefined,
  apiKeyId: number | null | undefined,
) {
  return ["storyteller", "provider-apikey-models", userID, apiKeyId];
}

export function useStorytellerProviderAPIKeyModels(
  apiKeyId: number | null | undefined,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: providerAPIKeyModelsQueryKey(session?.user.id, apiKeyId),
    enabled: Boolean(session?.encrypt_key && apiKeyId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerProviderAPIKeyModel[]>
      >(`${apiBase}/storyteller/provider-apikeys/${apiKeyId}/models`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useCreateStorytellerProviderAPIKeyModel() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apiKeyId,
      input,
    }: {
      apiKeyId: number;
      input: StorytellerProviderAPIKeyModelRequest;
    }) => {
      const response = await axios.post<
        CommonResponse<StorytellerProviderAPIKeyModel>
      >(`${apiBase}/storyteller/provider-apikeys/${apiKeyId}/models`, input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: providerAPIKeyModelsQueryKey(
          session?.user.id,
          variables.apiKeyId,
        ),
      });
    },
  });
}

export function useDeleteStorytellerProviderAPIKeyModel() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      apiKeyId,
      modelId,
    }: {
      apiKeyId: number;
      modelId: number;
    }) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/provider-apikeys/${apiKeyId}/models/${modelId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: providerAPIKeyModelsQueryKey(
          session?.user.id,
          variables.apiKeyId,
        ),
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

// storyId／loreId 互斥，對應 usage summary 分組出的某個 story/lore 節點，
// 不再用 agentId 篩選（見 Phase1至7工作項規劃.md Phase 8.7）。
export function useStorytellerAgentUsageLogs(
  providerApiKeyId: number,
  storyId: number | null,
  loreId: number | null,
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
      storyId,
      loreId,
      month,
      page,
      perPage,
    ],
    enabled:
      Boolean(session?.encrypt_key) &&
      Boolean(month) &&
      (storyId !== null || loreId !== null),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAgentUsageLogPage>
      >(`${apiBase}/storyteller/usage/logs`, {
        params: {
          provider_apikey_id: providerApiKeyId,
          story_id: storyId ?? undefined,
          lore_id: loreId ?? undefined,
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

type StorytellerAgentTargetKind = "story" | "lore";

// AI 助理唯一的送出 hook：一般對話與內建 skill（/rewrite 等）都走這裡，由 input.skill 決定。
// 全部非同步，回應只是「已落地、處理中」的確認（帶 chat_id），結果靠輪詢 chat 取得。
// 目標（專案／故事／設定集）放在請求體，不分 story／lore 兩套路由；故事／設定集只差 targetKind。
export function useSubmitStorytellerAgent(
  projectPublicId: string | undefined,
  targetKind: StorytellerAgentTargetKind,
  targetPublicId: string | undefined,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input }: { input: StorytellerAgentSubmitInput }) => {
      const body: StorytellerAgentSubmitRequest = {
        ...input,
        project_public_id: projectPublicId ?? "",
        ...(targetKind === "lore"
          ? { lore_public_id: targetPublicId }
          : { story_public_id: targetPublicId }),
      };
      const response = await axios.post<
        CommonResponse<StorytellerAgenticQueryResponse>
      >(`${apiBase}/storyteller/agent-chats`, body, {
        headers: sessionHeaders(session!.encrypt_key),
        timeout: agenticQueryTimeoutMs,
      });
      return response.data.data;
    },
    // 等訊息列表重新抓取完成後 mutation 才算結束，
    // 讓編輯器清除樂觀訊息時正式紀錄已經就位，避免訊息短暫消失
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["storyteller", `${targetKind}-chat-messages`],
      });
    },
  });
}

// 重新對一則卡在 pending（沒拿到回覆、已可重送）狀態的訊息呼叫 provider——不是開新的一輪
// 對話，答案會補進同一個 chat_id，讓歷史上的孤兒問題被補齊。一般對話與 skill 共用。
// input 只帶金鑰／模型這次的選擇，其餘後端一律重放當初存的那份 request。
export function useResendStorytellerAgent(
  targetKind: StorytellerAgentTargetKind,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      input,
    }: {
      chatId: number;
      input: StorytellerAgentSubmitInput;
    }) => {
      const response = await axios.post<
        CommonResponse<StorytellerAgenticQueryResponse>
      >(`${apiBase}/storyteller/agent-chats/${chatId}/resend`, input, {
        headers: sessionHeaders(session!.encrypt_key),
        timeout: agenticQueryTimeoutMs,
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["storyteller", `${targetKind}-chat-messages`],
      });
    },
  });
}

// 套用先前 useSubmitStorytellerAgent 回傳、被攔下來還沒真的執行的寫入類
// 工具呼叫。呼叫端要把當初收到的 StorytellerAgenticProposal 的 tool_name／
// arguments 原樣送回來。
// 提案的 tool_name／arguments 由後端自己保管（見後端 AgentProposal 的說明），
// 呼叫端只需要帶 public_id，不用再自己保存/回傳整份提案內容。
export function useApplyStorytellerAgentProposal(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalPublicId: string) => {
      const response = await axios.post<CommonResponse<unknown>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/agentic-proposals/${proposalPublicId}/apply`,
        {},
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    // 套用可能是改故事/設定集內容、也可能是刪除/搬移，影響範圍不固定，直接把
    // 整個 storyteller 底下的快取都標記過期，跟既有 useRevertStorytellerStoryVersion
    // 的做法一致，不用一一列出可能受影響的 query key。
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

// 把一筆 upsert_story／upsert_lore 提案標成 applied，但不執行底層工具——用在
// 前端已經把提案內容填進編輯區、透過一般存檔 API（save_trigger=agent_apply）
// 自己寫入過一次之後，只需要把這筆提案的狀態收尾，不能再讓後端拿提案裡的舊
// 參數重寫一次，蓋掉存檔當下可能已經手動調整過的內容。
export function useMarkStorytellerAgentProposalApplied(
  projectPublicId?: string,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalPublicId: string) => {
      const response = await axios.post<CommonResponse<unknown>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/agentic-proposals/${proposalPublicId}/mark-applied`,
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

// 把一筆已經 applied 的提案退回 pending——在「回復到套用前版本」成功之後呼叫，
// 讓這筆提案的決定跟著撤銷，使用者可以重新選擇套用或否決，不會卡在只剩「查看
// 變更」可以按、卻永遠沒辦法重新套用的死路。
export function useResetStorytellerAgentProposal(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalPublicId: string) => {
      const response = await axios.post<CommonResponse<unknown>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/agentic-proposals/${proposalPublicId}/reset`,
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

// 否決一筆還沒被處理的提案——不會真的執行，單純讓「使用者已經看過、決定不
// 套用」這件事持久化，重新整理頁面後這張提案卡片才不會又打回「待確認」。
export function useRejectStorytellerAgentProposal(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalPublicId: string) => {
      const response = await axios.post<CommonResponse<unknown>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/agentic-proposals/${proposalPublicId}/reject`,
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

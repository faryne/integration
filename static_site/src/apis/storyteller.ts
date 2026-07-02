import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerAgent,
  StorytellerAgentPromptVersion,
  StorytellerAgentProviderModels,
  StorytellerAgentRunRequest,
  StorytellerAgentRunResponse,
  StorytellerAgentRequest,
  StorytellerFavoriteAuthor,
  StorytellerLore,
  StorytellerLoreRequest,
  StorytellerLoreVersion,
  StorytellerProject,
  StorytellerProjectRanking,
  StorytellerProjectRequest,
  StorytellerStory,
  StorytellerStoryChatMessagePage,
  StorytellerStoryRequest,
  StorytellerStoryVersion,
  StorytellerUserProfile,
  StorytellerUserProfileRequest,
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

export function usePublicUserStorytellerProjects(
  username?: string,
  page = 1,
  pageSize = 20,
) {
  return useQuery({
    queryKey: ["storyteller", "public-user-projects", username, page, pageSize],
    enabled: Boolean(username),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<{
          items: StorytellerProject[];
          total: number;
          author?: StorytellerUserProfile;
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

export function usePublicStorytellerProject(projectPath?: string) {
  return useQuery({
    queryKey: ["storyteller", "public-project", projectPath],
    enabled: Boolean(projectPath),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerProject>>(
        `${apiBase}/storyteller/story/${encodeURIComponent(projectPath!)}`,
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

export function useDeleteStorytellerUserProfile() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/user`,
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
    queryKey: ["storyteller", "agent-prompt-versions", agentId, session?.user.id],
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

export function useStorytellerStoryChatMessages(
  projectPublicId?: string,
  storyPublicId?: string,
  page = 1,
  perPage = 10,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "story-chat-messages",
      projectPublicId,
      storyPublicId,
      page,
      perPage,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && storyPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryChatMessagePage>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/stories/${storyPublicId}/chat-messages`,
        {
          params: { page, per_page: perPage },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return (
        response.data.data ?? {
          items: [],
          total: 0,
          page,
          per_page: perPage,
        }
      );
    },
  });
}

export function useStorytellerLoreChatMessages(
  projectPublicId?: string,
  lorePublicId?: string,
  page = 1,
  perPage = 10,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "lore-chat-messages",
      projectPublicId,
      lorePublicId,
      page,
      perPage,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId && lorePublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryChatMessagePage>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/chat-messages`,
        {
          params: { page, per_page: perPage },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return (
        response.data.data ?? {
          items: [],
          total: 0,
          page,
          per_page: perPage,
        }
      );
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

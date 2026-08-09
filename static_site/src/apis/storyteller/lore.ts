import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerLore,
  StorytellerLoreCollection,
  StorytellerLoreCollectionRequest,
  StorytellerLoreRequest,
  StorytellerLoreVersion,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

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
  collectionId = "",
  page = 1,
  pageSize = 20,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "lores-page",
      projectPublicId,
      collectionId,
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
        params: { collection_id: collectionId, page, per_page: pageSize },
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

export function useStorytellerLoreCollections(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "lore-collections",
      projectPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerLoreCollection[]>
      >(`${apiBase}/storyteller/projects/${projectPublicId}/lore-collections`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}

export function useSaveStorytellerLoreCollection(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionPublicId,
      input,
    }: {
      collectionPublicId?: string;
      input: StorytellerLoreCollectionRequest;
    }) => {
      const base = `${apiBase}/storyteller/projects/${projectPublicId}/lore-collections`;
      const response = collectionPublicId
        ? await axios.put<CommonResponse<StorytellerLoreCollection>>(
            `${base}/${collectionPublicId}`,
            input,
            { headers: sessionHeaders(session!.encrypt_key) },
          )
        : await axios.post<CommonResponse<StorytellerLoreCollection>>(
            base,
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

export function useDeleteStorytellerLoreCollection(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (collectionPublicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/lore-collections/${collectionPublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useMoveStorytellerLore(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lorePublicId,
      collectionId,
    }: {
      lorePublicId: string;
      collectionId: string;
    }) => {
      const response = await axios.put<CommonResponse<StorytellerLore>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/lores/${lorePublicId}/move`,
        { collection_id: collectionId },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
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

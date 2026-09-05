import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerAsset,
  StorytellerAssetCollection,
  StorytellerAssetCollectionRequest,
  StorytellerAssetPage,
  StorytellerAssetReplaceOutput,
  StorytellerAssetUpdateRequest,
  StorytellerAssetUploadOutput,
  StorytellerImagePageUploadOutput,
  StorytellerStoryImagePage,
} from "@/types/storyteller.ts";
import {
  apiBase,
  ASSET_URL_REFRESH_INTERVAL_MS,
  sessionHeaders,
} from "./shared.ts";

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

export function useStorytellerAssets(
  projectPublicId?: string,
  page = 1,
  pageSize = 24,
  keyword = "",
  collectionId = "",
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "assets",
      projectPublicId,
      page,
      pageSize,
      keyword,
      collectionId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerAssetPage>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets`,
        {
          params: {
            page,
            page_size: pageSize,
            asset_type: "image",
            collection_id: collectionId || undefined,
            keyword: keyword.trim() || undefined,
          },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return (
        response.data.data ?? {
          assets: [],
          total_count: 0,
          page,
          page_size: pageSize,
        }
      );
    },
  });
}

export function useStorytellerAsset(
  projectPublicId?: string,
  assetPublicId?: string,
  enabled = true,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "asset",
      projectPublicId,
      assetPublicId,
      session?.user.id,
    ],
    enabled: Boolean(
      enabled && session?.encrypt_key && projectPublicId && assetPublicId,
    ),
    refetchInterval: ASSET_URL_REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerAsset>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/${assetPublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

// 資產上傳分兩段：先拿 presigned PUT URL，瀏覽器直傳 S3，完成後再 confirm 建立 DB row。
// 這裡包成一個 mutation，讓資產管理頁不用知道中間 API 細節。
export function useUploadStorytellerAssets(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      files,
      collectionId,
      onProgress,
    }: {
      files: File[];
      collectionId?: string;
      onProgress?: (index: number, loaded: number, total: number) => void;
    }) => {
      const presign = await axios.post<
        CommonResponse<StorytellerAssetUploadOutput[]>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/presign`,
        {
          files: files.map((file) => ({
            content_type: file.type,
            original_filename: file.name,
          })),
        },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      const uploads = presign.data.data ?? [];
      const assets: StorytellerAsset[] = [];
      for (const [index, file] of files.entries()) {
        const target = uploads[index];
        if (!target) {
          continue;
        }
        await axios.put(target.upload_url, file, {
          headers: { "Content-Type": file.type },
          onUploadProgress: (event) =>
            onProgress?.(index, event.loaded, event.total ?? file.size),
        });
        const confirm = await axios.post<CommonResponse<StorytellerAsset>>(
          `${apiBase}/storyteller/projects/${projectPublicId}/assets/confirm`,
          {
            key: target.key,
            content_type: file.type,
            collection_id: collectionId || "",
            original_filename: file.name,
            title: file.name,
            alt_text: "",
            description: "",
            metadata: {},
          },
          { headers: sessionHeaders(session!.encrypt_key) },
        );
        if (confirm.data.data) {
          assets.push(confirm.data.data);
        }
      }
      return assets;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

// 替換資產仍採兩段式：這個 mutation 只負責 presign + PUT，新檔上傳成功後
// 交給畫面顯示不可逆確認，再呼叫 confirm 真的切換 asset row 的 S3 key。
export function usePrepareStorytellerAssetReplace(projectPublicId?: string) {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({
      assetPublicId,
      file,
      onProgress,
    }: {
      assetPublicId: string;
      file: File;
      onProgress?: (loaded: number, total: number) => void;
    }) => {
      const presign = await axios.post<
        CommonResponse<StorytellerAssetReplaceOutput>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/${assetPublicId}/replace/presign`,
        { mime_type: file.type, filename: file.name, size: file.size },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      const upload = presign.data.data;
      if (!upload?.pending_key || !upload.upload_url) {
        throw new Error("替換上傳網址回應不完整");
      }
      await axios.put(upload.upload_url, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (event) =>
          onProgress?.(event.loaded, event.total ?? file.size),
      });
      return upload;
    },
  });
}

export function useConfirmStorytellerAssetReplace(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assetPublicId,
      pendingKey,
    }: {
      assetPublicId: string;
      pendingKey: string;
    }) => {
      const response = await axios.post<CommonResponse<StorytellerAsset>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/${assetPublicId}/replace/confirm`,
        { pending_key: pendingKey },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useStorytellerAssetCollections(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "asset-collections",
      projectPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAssetCollection[]>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/asset-collections`,
        {
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return response.data.data ?? [];
    },
  });
}

export function useSaveStorytellerAssetCollection(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      collectionPublicId,
      input,
    }: {
      collectionPublicId?: string;
      input: StorytellerAssetCollectionRequest;
    }) => {
      const base = `${apiBase}/storyteller/projects/${projectPublicId}/asset-collections`;
      const response = collectionPublicId
        ? await axios.put<CommonResponse<StorytellerAssetCollection>>(
            `${base}/${collectionPublicId}`,
            input,
            { headers: sessionHeaders(session!.encrypt_key) },
          )
        : await axios.post<CommonResponse<StorytellerAssetCollection>>(
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

export function useDeleteStorytellerAssetCollection(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (collectionPublicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/asset-collections/${collectionPublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
    },
  });
}

export function useMoveStorytellerAsset(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assetPublicId,
      collectionId,
    }: {
      assetPublicId: string;
      collectionId: string;
    }) => {
      const response = await axios.put<CommonResponse<StorytellerAsset>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/${assetPublicId}/move`,
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

export function useUpdateStorytellerAsset(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assetPublicId,
      input,
    }: {
      assetPublicId: string;
      input: StorytellerAssetUpdateRequest;
    }) => {
      const response = await axios.put<CommonResponse<StorytellerAsset>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/${assetPublicId}`,
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

export function useDeleteStorytellerAsset(projectPublicId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assetPublicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/projects/${projectPublicId}/assets/${assetPublicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["storyteller"] });
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
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "public-image-story-pages",
      projectPath,
      storyPublicId,
      session?.user.id,
    ],
    enabled: Boolean(projectPath && storyPublicId),
    retry: false,
    refetchInterval: ASSET_URL_REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerStoryImagePage[]>
      >(
        `${apiBase}/storyteller/story/${encodeURIComponent(projectPath!)}/stories/${storyPublicId}/image-pages`,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
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
    refetchInterval: ASSET_URL_REFRESH_INTERVAL_MS,
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

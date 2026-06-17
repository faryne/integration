import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  GalgameBrand,
  GalgameFavoriteStatus,
  GalgameFavoriteStatuses,
  GalgameVideo,
  GalgameVideoNavigation,
  GalgameVideoReactionAction,
  GalgameVideoReactionStatus,
  GalgameVideoSearch,
  GalgameVideoSubmission,
} from "@/types/galgame.ts";

const apiBase = import.meta.env.VITE_API_BASE;

function normalizePagination<T>(pagination: Pagination<T[]>) {
  return {
    ...pagination,
    data: pagination.data ?? [],
  };
}

export function useGalgameBrands(keyword = "", page = 1, perPage = 24) {
  return useQuery({
    queryKey: ["galgame-brands", keyword, page, perPage],
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameBrand[]>>
      >(`${apiBase}/galgame/brands`, {
        params: {
          keyword: keyword || undefined,
          page,
          per_page: perPage,
        },
      });
      const pagination = normalizePagination(response.data.data);
      return {
        ...pagination,
        data: pagination.data.map((brand) => ({
          ...brand,
          links: brand.links ?? [],
        })),
      };
    },
  });
}

export interface GalgameBrandSubmissionResult {
  input: string;
  brand?: GalgameBrand;
  created: boolean;
  error?: string;
}

export function useSubmitGalgameBrands() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (channels: string[]) => {
      const response = await axios.post<
        CommonResponse<GalgameBrandSubmissionResult[]>
      >(
        `${apiBase}/galgame/brands/submissions`,
        { channels },
        session?.encrypt_key
          ? { headers: sessionHeaders(session.encrypt_key) }
          : undefined,
      );
      return response.data.data ?? [];
    },
  });
}

export interface GalgameVideoSubmissionResult {
  input: string;
  submission?: GalgameVideoSubmission;
  created: boolean;
  error?: string;
}

export function useSubmitGalgameVideos() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (urls: string[]) => {
      const response = await axios.post<
        CommonResponse<GalgameVideoSubmissionResult[]>
      >(
        `${apiBase}/galgame/videos/submissions`,
        { urls },
        session?.encrypt_key
          ? { headers: sessionHeaders(session.encrypt_key) }
          : undefined,
      );
      return response.data.data ?? [];
    },
  });
}

export function useAdminGalgameBrands(
  status = "pending",
  page = 1,
  perPage = 24,
  keyword = "",
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "galgame-admin-brands",
      session?.user.id,
      status,
      keyword,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key && session.user.is_admin),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameBrand[]>>
      >(`${apiBase}/admin/galgame/brands`, {
        params: { status, keyword: keyword || undefined, page, per_page: perPage },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return normalizePagination(response.data.data);
    },
  });
}

export function useSetGalgameBrandStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      brandId,
      status,
    }: {
      brandId: number;
      status: "pending" | "approved" | "rejected";
    }) => {
      const response = await axios.put<CommonResponse<GalgameBrand>>(
        `${apiBase}/admin/galgame/brands/${brandId}/status`,
        { status },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["galgame-admin-brands"] });
      void queryClient.invalidateQueries({ queryKey: ["galgame-brands"] });
    },
  });
}

export function useGalgameBrandAdminAction() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      brandId,
      action,
    }: {
      brandId: number;
      action: "delete" | "restore" | "pause" | "resume";
    }) => {
      const headers = sessionHeaders(session!.encrypt_key);
      if (action === "delete") {
        await axios.delete(`${apiBase}/admin/galgame/brands/${brandId}`, {
          headers,
        });
        return;
      }
      const path =
        action === "restore"
          ? "restore"
          : action === "pause"
            ? "pause-indexing"
            : "resume-indexing";
      await axios.put(
        `${apiBase}/admin/galgame/brands/${brandId}/${path}`,
        {},
        { headers },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["galgame-admin-brands"] });
      void queryClient.invalidateQueries({ queryKey: ["galgame-brands"] });
    },
  });
}

export function useAdminGalgameVideos(
  status = "all",
  keyword = "",
  page = 1,
  perPage = 24,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "galgame-admin-videos",
      session?.user.id,
      status,
      keyword,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key && session.user.is_admin),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameVideo[]>>
      >(`${apiBase}/admin/galgame/videos`, {
        params: { status, keyword: keyword || undefined, page, per_page: perPage },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return normalizePagination(response.data.data);
    },
  });
}

export function useGalgameVideoAdminAction() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      videoId,
      action,
    }: {
      videoId: number;
      action: "delete" | "restore";
    }) => {
      const headers = sessionHeaders(session!.encrypt_key);
      if (action === "delete") {
        await axios.delete(`${apiBase}/admin/galgame/videos/${videoId}`, {
          headers,
        });
        return;
      }
      await axios.put(
        `${apiBase}/admin/galgame/videos/${videoId}/restore`,
        {},
        { headers },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["galgame-admin-videos"] });
      void queryClient.invalidateQueries({ queryKey: ["galgame-videos"] });
    },
  });
}

export const useDeleteGalgameVideo = useGalgameVideoAdminAction;

export function useAdminGalgameVideoSubmissions(
  status = "pending",
  page = 1,
  perPage = 24,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "galgame-admin-video-submissions",
      session?.user.id,
      status,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key && session.user.is_admin),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameVideoSubmission[]>>
      >(`${apiBase}/admin/galgame/video-submissions`, {
        params: { status, page, per_page: perPage },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return normalizePagination(response.data.data);
    },
  });
}

export function useSetGalgameVideoSubmissionStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      submissionId,
      status,
    }: {
      submissionId: number;
      status: "pending" | "approved" | "rejected";
    }) => {
      await axios.put(
        `${apiBase}/admin/galgame/video-submissions/${submissionId}/status`,
        { status },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-video-submissions"],
      });
      void queryClient.invalidateQueries({ queryKey: ["galgame-admin-videos"] });
      void queryClient.invalidateQueries({ queryKey: ["galgame-videos"] });
    },
  });
}

export function useGalgameBrand(brand?: string) {
  return useQuery({
    queryKey: ["galgame-brand", brand],
    enabled: Boolean(brand),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameBrand>>(
        `${apiBase}/galgame/brands/${brand}`,
      );
      return {
        ...response.data.data,
        links: response.data.data.links ?? [],
      };
    },
  });
}

export function useGalgameVideos(
  brandId: string | undefined,
  search: GalgameVideoSearch,
  enabled = true,
) {
  return useQuery({
    queryKey: ["galgame-videos", brandId, search],
    enabled,
    queryFn: async () => {
      const prefix = brandId ? `/galgame/${brandId}/video` : "/galgame/video";
      const response = await axios.get<
        CommonResponse<Pagination<GalgameVideo[]>>
      >(`${apiBase}${prefix}`, { params: search });
      return normalizePagination(response.data.data);
    },
  });
}

export function useGalgameVideo(brandId?: string, videoId?: string) {
  return useQuery({
    queryKey: ["galgame-video", brandId, videoId],
    enabled: Boolean(brandId && videoId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameVideo>>(
        `${apiBase}/galgame/${brandId}/video/${videoId}`,
      );
      return response.data.data;
    },
  });
}

export function useRelatedGalgameVideos(brandId?: string, videoId?: string) {
  return useQuery({
    queryKey: ["galgame-related-videos", brandId, videoId],
    enabled: Boolean(brandId && videoId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameVideo[]>>(
        `${apiBase}/galgame/${brandId}/video/${videoId}/related`,
      );
      return response.data.data ?? [];
    },
  });
}

function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}

function invalidateFavoriteQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: ["galgame-favorite-status"] });
  void queryClient.invalidateQueries({ queryKey: ["galgame-favorite-brands"] });
  void queryClient.invalidateQueries({ queryKey: ["galgame-favorite-videos"] });
}

export function useGalgameBrandFavorite(brandId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["galgame-brand-favorite", session?.user.id, brandId];
  const query = useQuery({
    queryKey,
    enabled: Boolean(session?.encrypt_key && brandId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameFavoriteStatus>>(
        `${apiBase}/galgame/brands/${brandId}/favorite`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (favorite: boolean) => {
      const response = await axios.put<CommonResponse<GalgameFavoriteStatus>>(
        `${apiBase}/galgame/brands/${brandId}/favorite`,
        { favorite },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(queryKey, status);
      invalidateFavoriteQueries(queryClient);
    },
  });
  return { ...query, favorite: query.data?.favorite ?? false, mutation };
}

export function useGalgameVideoFavorite(
  brandId?: string,
  videoId?: string,
  loadStatus = true,
) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = [
    "galgame-video-favorite",
    session?.user.id,
    brandId,
    videoId,
  ];
  const query = useQuery({
    queryKey,
    enabled: Boolean(loadStatus && session?.encrypt_key && brandId && videoId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameFavoriteStatus>>(
        `${apiBase}/galgame/${brandId}/video/${videoId}/favorite`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (favorite: boolean) => {
      const response = await axios.put<CommonResponse<GalgameFavoriteStatus>>(
        `${apiBase}/galgame/${brandId}/video/${videoId}/favorite`,
        { favorite },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(queryKey, status);
      invalidateFavoriteQueries(queryClient);
    },
  });
  return { ...query, favorite: query.data?.favorite ?? false, mutation };
}

export function useGalgameVideoReaction(brandId?: string, videoId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = [
    "galgame-video-reaction",
    session?.user.id,
    brandId,
    videoId,
  ];
  const query = useQuery({
    queryKey,
    enabled: Boolean(session?.encrypt_key && brandId && videoId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<GalgameVideoReactionStatus>
      >(`${apiBase}/galgame/${brandId}/video/${videoId}/reaction`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (action: GalgameVideoReactionAction) => {
      const response = await axios.put<
        CommonResponse<GalgameVideoReactionStatus>
      >(
        `${apiBase}/galgame/${brandId}/video/${videoId}/reaction`,
        { action },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(queryKey, status);
      void queryClient.invalidateQueries({
        queryKey: ["galgame-video", brandId, videoId],
      });
    },
  });
  return {
    ...query,
    reaction: query.data?.reaction ?? "",
    likes: query.data?.likes,
    dislikes: query.data?.dislikes,
    mutation,
  };
}

export function useGalgameVideoNavigation(brandId?: string, videoId?: string) {
  return useQuery({
    queryKey: ["galgame-video-navigation", brandId, videoId],
    enabled: Boolean(brandId && videoId),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<GalgameVideoNavigation>>(
        `${apiBase}/galgame/${brandId}/video/${videoId}/navigation`,
      );
      return response.data.data;
    },
  });
}

export function useGalgameFavoriteStatus(
  brandIds: number[],
  videoIds: number[],
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["galgame-favorite-status", session?.user.id, brandIds, videoIds],
    enabled: Boolean(
      session?.encrypt_key && (brandIds.length > 0 || videoIds.length > 0),
    ),
    queryFn: async () => {
      const response = await axios.post<
        CommonResponse<GalgameFavoriteStatuses>
      >(
        `${apiBase}/galgame/favorites/status`,
        { brand_ids: brandIds, video_ids: videoIds },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

export function useFavoriteGalgameBrands(keyword = "", page = 1, perPage = 24) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "galgame-favorite-brands",
      session?.user.id,
      keyword,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameBrand[]>>
      >(`${apiBase}/galgame/favorites/brands`, {
        params: { keyword: keyword || undefined, page, per_page: perPage },
        headers: sessionHeaders(session!.encrypt_key),
      });
      const pagination = normalizePagination(response.data.data);
      return {
        ...pagination,
        data: pagination.data.map((brand) => ({
          ...brand,
          links: brand.links ?? [],
        })),
      };
    },
  });
}

export function useFavoriteGalgameVideos(keyword = "", page = 1, perPage = 24) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "galgame-favorite-videos",
      session?.user.id,
      keyword,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameVideo[]>>
      >(`${apiBase}/galgame/favorites/videos`, {
        params: { keyword: keyword || undefined, page, per_page: perPage },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return normalizePagination(response.data.data);
    },
  });
}

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  GalgameBrand,
  GalgameFavoriteStatus,
  GalgameVideo,
  GalgameVideoNavigation,
  GalgameVideoSearch,
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
    onSuccess: (status) => queryClient.setQueryData(queryKey, status),
  });
  return { ...query, favorite: query.data?.favorite ?? false, mutation };
}

export function useGalgameVideoFavorite(brandId?: string, videoId?: string) {
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
    enabled: Boolean(session?.encrypt_key && brandId && videoId),
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
    onSuccess: (status) => queryClient.setQueryData(queryKey, status),
  });
  return { ...query, favorite: query.data?.favorite ?? false, mutation };
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

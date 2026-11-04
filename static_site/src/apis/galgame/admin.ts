import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import {
  apiBase,
  normalizePagination,
  sessionHeaders,
} from "@/apis/galgame/shared.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  GalgameBrand,
  GalgameVideo,
  GalgameVideoSubmission,
  GalgameVideoTitleKeyword,
} from "@/types/galgame.ts";

// galgame 管理後台（/backend_admin/galgame/*）用的 API：查詢只在登入者是管理者時才送出
// enabled：只想在特定情境查詢時傳 false（例如帳號選單沒有後台連結時）
export function useAdminGalgameBrands(
  status = "pending",
  page = 1,
  perPage = 24,
  keyword = "",
  enabled = true,
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
    enabled: enabled && Boolean(session?.encrypt_key && session.user.is_admin),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameBrand[]>>
      >(`${apiBase}/admin/galgame/brands`, {
        params: {
          status,
          keyword: keyword || undefined,
          page,
          per_page: perPage,
        },
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
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-brands"],
      });
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
      action: "delete" | "restore" | "pause" | "resume" | "sync";
    }) => {
      const headers = sessionHeaders(session!.encrypt_key);
      if (action === "delete") {
        await axios.delete(`${apiBase}/admin/galgame/brands/${brandId}`, {
          headers,
        });
        return;
      }
      if (action === "sync") {
        await axios.post(
          `${apiBase}/admin/galgame/brands/${brandId}/sync-videos`,
          {},
          { headers },
        );
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
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-brands"],
      });
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
        params: {
          status,
          keyword: keyword || undefined,
          page,
          per_page: perPage,
        },
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
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-videos"],
      });
      void queryClient.invalidateQueries({ queryKey: ["galgame-videos"] });
    },
  });
}

export function useAdminGalgameVideoSubmissions(
  status = "pending",
  page = 1,
  perPage = 24,
  enabled = true,
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
    enabled: enabled && Boolean(session?.encrypt_key && session.user.is_admin),
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
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-videos"],
      });
      void queryClient.invalidateQueries({ queryKey: ["galgame-videos"] });
    },
  });
}

export function useAdminGalgameVideoTitleKeywords(
  keyword = "",
  enabled = "all",
  page = 1,
  perPage = 20,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "galgame-admin-video-title-keywords",
      session?.user.id,
      keyword,
      enabled,
      page,
      perPage,
    ],
    enabled: Boolean(session?.encrypt_key && session.user.is_admin),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<GalgameVideoTitleKeyword[]>>
      >(`${apiBase}/admin/galgame/video-title-keywords`, {
        params: {
          keyword: keyword || undefined,
          enabled: enabled === "all" ? undefined : enabled,
          page,
          per_page: perPage,
        },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return normalizePagination(response.data.data);
    },
  });
}

export function useCreateGalgameVideoTitleKeyword() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keyword: string) => {
      const response = await axios.post<
        CommonResponse<GalgameVideoTitleKeyword>
      >(
        `${apiBase}/admin/galgame/video-title-keywords`,
        { keyword, enabled: true },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-video-title-keywords"],
      });
    },
  });
}

export function useUpdateGalgameVideoTitleKeyword() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      keywordId,
      keyword,
      enabled,
    }: {
      keywordId: number;
      keyword?: string;
      enabled?: boolean;
    }) => {
      const response = await axios.put<
        CommonResponse<GalgameVideoTitleKeyword>
      >(
        `${apiBase}/admin/galgame/video-title-keywords/${keywordId}`,
        { keyword, enabled },
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-video-title-keywords"],
      });
    },
  });
}

export function useDeleteGalgameVideoTitleKeyword() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (keywordId: number) => {
      await axios.delete(
        `${apiBase}/admin/galgame/video-title-keywords/${keywordId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["galgame-admin-video-title-keywords"],
      });
    },
  });
}

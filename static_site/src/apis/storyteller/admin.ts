import axios from "axios";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  AdminMe,
  AdminReportDetail,
  AdminReportList,
  AdminReportStatus,
  AdminTargetFilter,
  AdminTargetType,
} from "@/types/storytellerAdmin.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 管理後台 API：只接受 session，權限由後端每次檢查（前端隱藏入口只是體驗）。

const adminQueryKey = ["storyteller", "admin"];

function useAdminHeaders() {
  const { session } = useAuth();
  return {
    userId: session?.user.id,
    headers: session ? sessionHeaders(session.encrypt_key) : undefined,
  };
}

// useAdminMe：目前帳號的平台權限；沒登入不打。
export function useAdminMe() {
  const { userId, headers } = useAdminHeaders();
  return useQuery({
    queryKey: [...adminQueryKey, "me", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<AdminMe>>(
          `${apiBase}/storyteller/admin/me`,
          { headers },
        )
      ).data.data,
  });
}

export function useAdminReports(
  params: {
    status: AdminReportStatus;
    targetType?: AdminTargetFilter;
    page: number;
  },
  enabled = true,
) {
  const { userId, headers } = useAdminHeaders();
  return useQuery({
    queryKey: [...adminQueryKey, "reports", params, userId],
    enabled: enabled && Boolean(userId),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<AdminReportList>>(
          `${apiBase}/storyteller/admin/reports`,
          {
            headers,
            params: {
              status: params.status,
              target_type: params.targetType,
              page: params.page,
            },
          },
        )
      ).data.data,
  });
}

export function useAdminReportDetail(type: AdminTargetType, publicId: string) {
  const { userId, headers } = useAdminHeaders();
  return useQuery({
    queryKey: [...adminQueryKey, "report", type, publicId, userId],
    enabled: Boolean(userId && type && publicId),
    queryFn: async () =>
      (
        await axios.get<CommonResponse<AdminReportDetail>>(
          `${apiBase}/storyteller/admin/reports/${type}/${publicId}`,
          { headers },
        )
      ).data.data,
  });
}

export type AdminReportAction =
  { type: "remove"; reasonKey: string } | { type: "dismiss" };

// 處置後讓列表與詳情重抓（tab 上的數字也會更新）
export function useAdminReportAction(type: AdminTargetType, publicId: string) {
  const { headers } = useAdminHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: AdminReportAction) =>
      axios.post(
        `${apiBase}/storyteller/admin/reports/${type}/${publicId}/${action.type}`,
        action.type === "remove" ? { reason_key: action.reasonKey } : {},
        { headers },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminQueryKey }),
  });
}

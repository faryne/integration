import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAdminSession } from "@/apis/av/adminSession.ts";
import type {
  ActressTopicAdminItem,
  ActressTopicOptions,
  ActressTopicSaveRequest,
} from "@/types/avActressTopic.ts";

const adminBase = `${import.meta.env.VITE_API_BASE}/admin/av/actress-topics`;
const adminKey = "av-actress-topics-admin";

/** 自訂主題列表（含停用） */
export function useAdminActressTopics() {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [adminKey, "list"],
    enabled,
    retry: false,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<ActressTopicAdminItem[]>>(adminBase, {
          headers,
        })
      ).data.data,
  });
}

/** 編輯頁；id 為 0 是新增，不打 API */
export function useAdminActressTopic(id: number) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [adminKey, "detail", id],
    enabled: enabled && id > 0,
    retry: false,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<ActressTopicAdminItem>>(
          `${adminBase}/${id}`,
          { headers },
        )
      ).data.data,
  });
}

/** 自動完成的選項（出身地、類型），後端有 1 小時快取 */
export function useActressTopicOptions() {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [adminKey, "options"],
    enabled,
    retry: false,
    staleTime: 30 * 60 * 1000,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<ActressTopicOptions>>(
          `${adminBase}/options`,
          { headers },
        )
      ).data.data,
  });
}

/** 新增／修改、啟用切換、排序、刪除；成功後清掉列表與單筆的快取 */
export function useActressTopicMutations() {
  const { headers } = useAdminSession();
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: [adminKey] });
  return {
    save: useMutation({
      mutationFn: async ({
        id,
        body,
      }: {
        id: number;
        body: ActressTopicSaveRequest;
      }) =>
        (
          await (id > 0
            ? axios.put<CommonResponse<ActressTopicAdminItem>>(
                `${adminBase}/${id}`,
                body,
                { headers },
              )
            : axios.post<CommonResponse<ActressTopicAdminItem>>(
                adminBase,
                body,
                { headers },
              ))
        ).data.data,
      onSuccess,
    }),
    setEnabled: useMutation({
      mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
        axios.put(`${adminBase}/${id}/enabled`, { enabled }, { headers }),
      onSuccess,
    }),
    sort: useMutation({
      mutationFn: (ids: number[]) =>
        axios.put(`${adminBase}/sort`, { ids }, { headers }),
      onSuccess,
    }),
    // 刪掉的那筆直接移除快取，不然重新整理時會再去抓一次而 404
    remove: useMutation({
      mutationFn: (id: number) =>
        axios.delete(`${adminBase}/${id}`, { headers }),
      onSuccess: (_, id) => {
        queryClient.removeQueries({ queryKey: [adminKey, "detail", id] });
        return queryClient.invalidateQueries({ queryKey: [adminKey, "list"] });
      },
    }),
  };
}

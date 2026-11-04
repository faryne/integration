import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import { useAdminSession } from "@/apis/av/adminSession.ts";
import type { SubmissionStatus } from "@/types/avSubmission.ts";

const apiBase = import.meta.env.VITE_API_BASE;

/**
 * 上稿審核的管理 API（/admin/av/{resource}）：女優上稿、影片修改的列表、待審數、單筆、核准／否決、找下一張都一樣，
 * 只有 resource 與資料型別不同，所以做成 factory，兩邊各建一份
 */
export function submissionAdminApi<Summary extends { id: number }, Detail>(
  resource: string,
) {
  const base = `${apiBase}/admin/av/${resource}`;
  const key = `av-${resource}`;

  const fetchList = (
    headers: Record<string, string> | undefined,
    status: SubmissionStatus,
    page: number,
    perPage: number,
  ) =>
    axios
      .get<CommonResponse<Pagination<Summary[]>>>(base, {
        params: { status, page, per_page: perPage },
        headers,
      })
      .then((r) => r.data.data);

  return {
    /** 管理列表 */
    useList(status: SubmissionStatus, page: number) {
      const { enabled, headers } = useAdminSession();
      return useQuery({
        queryKey: [key, "list", status, page],
        enabled,
        retry: false,
        queryFn: () => fetchList(headers, status, page, 30),
      });
    },

    /** 待審核數量（後台側欄、帳號選單的提示用） */
    usePendingCount(enabled: boolean) {
      const admin = useAdminSession();
      return useQuery({
        queryKey: [key, "pending-count"],
        enabled: enabled && admin.enabled,
        retry: false,
        staleTime: 60_000,
        queryFn: async () =>
          (await fetchList(admin.headers, "pending", 1, 1)).total,
      });
    },

    /** 審核頁 */
    useDetail(id: number) {
      const { enabled, headers } = useAdminSession();
      return useQuery({
        queryKey: [key, "detail", id],
        enabled: enabled && id > 0,
        retry: false,
        queryFn: async () =>
          (
            await axios.get<CommonResponse<Detail>>(`${base}/${id}`, {
              headers,
            })
          ).data.data,
      });
    },

    /** 核准／否決；成功後清掉列表、數量與該單的快取 */
    useReview(id: number) {
      const { headers } = useAdminSession();
      const queryClient = useQueryClient();
      const onSuccess = () =>
        queryClient.invalidateQueries({ queryKey: [key] });
      const approve = useMutation({
        mutationFn: (body: object = {}) =>
          axios.put(`${base}/${id}/approve`, body, { headers }),
        onSuccess,
      });
      const reject = useMutation({
        mutationFn: (reviewNote: string) =>
          axios.put(
            `${base}/${id}/reject`,
            { review_note: reviewNote },
            { headers },
          ),
        onSuccess,
      });
      return { approve, reject };
    },

    /**
     * 審核完要接著審的下一張：照列表順序（新的在前）往下找比目前舊的待審單，
     * 已經是最舊的就從最新的待審單開始；沒有待審單回傳 null
     */
    useFindNextPending() {
      const { headers } = useAdminSession();
      return async (currentId: number) => {
        const ids = (await fetchList(headers, "pending", 1, 100)).data
          .map((s) => s.id)
          .filter((id) => id !== currentId);
        return ids.find((id) => id < currentId) ?? ids[0] ?? null;
      };
    },
  };
}

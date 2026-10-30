import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import { sessionHeaders } from "@/apis/storyteller/shared.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  ActressSubmissionDetail,
  ActressSubmissionStatus,
  ActressSubmissionSummary,
  ActressSubmitRequest,
  ActressSubmitResult,
} from "@/types/avActressSubmission.ts";

const apiBase = import.meta.env.VITE_API_BASE;
const adminBase = `${apiBase}/admin/av/actress-submissions`;
const adminKey = "av-actress-submissions";

/** 提交新增／修改：不需登入，有登入就帶上 session 讓後端記錄提交者 */
export function useSubmitActress() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (body: ActressSubmitRequest) => {
      const response = await axios.post<CommonResponse<ActressSubmitResult>>(
        `${apiBase}/opendata/av/actress/submissions`,
        body,
        session ? { headers: sessionHeaders(session.encrypt_key) } : undefined,
      );
      return response.data.data;
    },
  });
}

/** 管理者才查得到；不是管理者時 enabled 為 false，不會打 API */
function useAdminSession() {
  const { session } = useAuth();
  return {
    enabled: Boolean(session?.encrypt_key && session.user.is_admin),
    headers: session ? sessionHeaders(session.encrypt_key) : undefined,
  };
}

/** 管理列表 */
export function useActressSubmissions(
  status: ActressSubmissionStatus,
  page: number,
) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [adminKey, "list", status, page],
    enabled,
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<ActressSubmissionSummary[]>>
      >(adminBase, { params: { status, page, per_page: 30 }, headers });
      return response.data.data;
    },
  });
}

/** 待審核數量（頭像選單的提示用） */
export function usePendingActressSubmissionCount(enabled: boolean) {
  const admin = useAdminSession();
  return useQuery({
    queryKey: [adminKey, "pending-count"],
    enabled: enabled && admin.enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<ActressSubmissionSummary[]>>
      >(adminBase, {
        params: { status: "pending", page: 1, per_page: 1 },
        headers: admin.headers,
      });
      return response.data.data.total;
    },
  });
}

/** 審核頁 */
export function useActressSubmission(id: number) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [adminKey, "detail", id],
    enabled: enabled && id > 0,
    retry: false,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<ActressSubmissionDetail>>(
        `${adminBase}/${id}`,
        { headers },
      );
      return response.data.data;
    },
  });
}

/** 核准／否決；成功後清掉列表、數量與該單的快取 */
export function useReviewActressSubmission(id: number) {
  const { headers } = useAdminSession();
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: [adminKey] });
  const approve = useMutation({
    mutationFn: (mergeTarget: string) =>
      axios.put(
        `${adminBase}/${id}/approve`,
        { merge_target: mergeTarget },
        { headers },
      ),
    onSuccess,
  });
  const reject = useMutation({
    mutationFn: (reviewNote: string) =>
      axios.put(
        `${adminBase}/${id}/reject`,
        { review_note: reviewNote },
        { headers },
      ),
    onSuccess,
  });
  return { approve, reject };
}

/**
 * 審核完要接著審的下一張：照列表順序（新的在前）往下找比目前舊的待審單，
 * 已經是最舊的就從最新的待審單開始；沒有待審單回傳 null
 */
export function useFindNextPendingSubmission() {
  const { headers } = useAdminSession();
  return async (currentId: number) => {
    const response = await axios.get<
      CommonResponse<Pagination<ActressSubmissionSummary[]>>
    >(adminBase, {
      params: { status: "pending", page: 1, per_page: 100 },
      headers,
    });
    const ids = response.data.data.data
      .map((s) => s.id)
      .filter((id) => id !== currentId);
    return ids.find((id) => id < currentId) ?? ids[0] ?? null;
  };
}

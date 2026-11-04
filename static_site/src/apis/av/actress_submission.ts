import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { sessionHeaders } from "@/apis/storyteller/shared.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { submissionAdminApi } from "@/apis/av/submission_admin.ts";
import type {
  ActressSubmissionDetail,
  ActressSubmissionSummary,
  ActressSubmitRequest,
  ActressSubmitResult,
} from "@/types/avActressSubmission.ts";

const apiBase = import.meta.env.VITE_API_BASE;

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

// 管理 API：列表、待審數、單筆、核准／否決、找下一張（與影片修改共用 factory）
const admin = submissionAdminApi<
  ActressSubmissionSummary,
  ActressSubmissionDetail
>("actress-submissions");
export const useActressSubmissions = admin.useList;
export const usePendingActressSubmissionCount = admin.usePendingCount;
export const useActressSubmission = admin.useDetail;
export const useReviewActressSubmission = admin.useReview;
export const useFindNextPendingSubmission = admin.useFindNextPending;

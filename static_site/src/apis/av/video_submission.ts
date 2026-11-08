import { useEffect } from "react";
import axios from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { sessionHeaders } from "@/apis/storyteller/shared.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { submissionAdminApi } from "@/apis/av/submission_admin.ts";
import type {
  VideoSubmissionDetail,
  VideoSubmissionSummary,
  VideoSubmitRequest,
  VideoSubmitResult,
  VideoTermKey,
  VideoTermOption,
} from "@/types/avVideoSubmission.ts";
import { loadRecaptcha, recaptchaHeaders } from "@/lib/recaptcha.ts";

const apiBase = import.meta.env.VITE_API_BASE;

/** 提交影片修改：不需登入，有登入就帶上 session 讓後端記錄提交者 */
export function useSubmitVideo() {
  const { session } = useAuth();
  // 表單頁一打開就先載入 reCAPTCHA，送出時取 token 比較快、風險分數也比較準
  useEffect(() => {
    void loadRecaptcha();
  }, []);
  return useMutation({
    mutationFn: async (body: VideoSubmitRequest) => {
      const response = await axios.post<CommonResponse<VideoSubmitResult>>(
        `${apiBase}/opendata/av/video/submissions`,
        body,
        {
          headers: {
            ...(await recaptchaHeaders("VIDEO_SUBMIT")),
            ...(session && sessionHeaders(session.encrypt_key)),
          },
        },
      );
      return response.data.data;
    },
  });
}

/** 修改表單陣列欄位的 autocomplete；後端有快取，前端也保留 10 分鐘 */
export function useVideoTermSuggest(field: VideoTermKey, q: string) {
  return useQuery({
    queryKey: ["av-video-suggest", field, q],
    staleTime: 600_000,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<VideoTermOption[]>>(
        `${apiBase}/opendata/av/video/suggest`,
        { params: { field, q } },
      );
      return response.data.data;
    },
  });
}

// 管理 API：列表、待審數、單筆、核准／否決、找下一張（與女優上稿共用 factory）
const admin = submissionAdminApi<VideoSubmissionSummary, VideoSubmissionDetail>(
  "video-submissions",
);
export const useVideoSubmissions = admin.useList;
export const usePendingVideoSubmissionCount = admin.usePendingCount;
export const useVideoSubmission = admin.useDetail;
export const useReviewVideoSubmission = admin.useReview;
export const useFindNextPendingVideoSubmission = admin.useFindNextPending;

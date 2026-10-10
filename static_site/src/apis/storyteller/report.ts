import axios from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  ModerationReason,
  ReportInput,
  ReportTargetType,
} from "@/types/storytellerReport.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 讀者檢舉：理由列表公開（依對象種類過濾），送出需登入。

export function useModerationReasons(targetType: ReportTargetType | undefined) {
  return useQuery({
    queryKey: ["storyteller", "moderation-reasons", targetType],
    enabled: Boolean(targetType),
    // 理由表幾乎不變，開過一次 dialog 就沿用
    staleTime: 60 * 60 * 1000,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<ModerationReason[]>>(
          `${apiBase}/storyteller/moderation-reasons`,
          { params: { target_type: targetType } },
        )
      ).data.data,
  });
}

export function useCreateReport() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: (input: ReportInput) =>
      axios.post(`${apiBase}/storyteller/reports`, input, {
        headers: session ? sessionHeaders(session.encrypt_key) : undefined,
      }),
  });
}

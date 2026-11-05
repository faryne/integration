import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import type {
  CopyrightClaim,
  CopyrightClaimStatus,
  CopyrightClaimSubmitRequest,
  CopyrightClaimSubmitResult,
} from "@/types/nekomaidForbidden.ts";

// neko.maid.tw 版權申告的公開 API：作品頁送出、/copyright-claim 處理結果列表
const claimBase = `${import.meta.env.VITE_API_BASE}/nekomaid/forbidden-submissions`;
export const COPYRIGHT_CLAIM_PAGE_SIZE = 20;

/** 送出版權申告；成功後重新整理處理結果列表 */
export function useSubmitCopyrightClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CopyrightClaimSubmitRequest) =>
      (
        await axios.post<CommonResponse<CopyrightClaimSubmitResult>>(
          claimBase,
          input,
        )
      ).data.data,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["copyright-claims"] }),
  });
}

/** 處理結果列表；hash 有值時只列同一 IP 送出的申告 */
export function useCopyrightClaims(
  status: CopyrightClaimStatus | "",
  page: number,
  hash = "",
) {
  return useQuery({
    queryKey: ["copyright-claims", hash, status, page],
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<Pagination<CopyrightClaim[] | null>>
      >(hash ? `${claimBase}/${encodeURIComponent(hash)}` : claimBase, {
        params: {
          status: status || undefined,
          page,
          per_page: COPYRIGHT_CLAIM_PAGE_SIZE,
        },
      });
      const data = response.data.data;
      return { ...data, data: data.data ?? [] };
    },
  });
}

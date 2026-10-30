import type {
  CommonResponse,
  ListByPaginationRequest,
  Pagination,
} from "@/apis/interfaces.ts";
import type { Actress } from "@/types/av.ts";
import type { ActressRef } from "@/helpers/avActressRef.ts";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// ActressRef：指定是哪一位（女優頁網址的參數），指定了卻對不到時回空結果
export interface ActressSearchRequest extends ActressRef {
  page: number;
  b?: number[];
  w?: number[];
  h?: number[];
  cup?: string;
  // 複選罩杯，逗號分隔（A,B,D），符合任一個即可
  cups?: string;
  height?: number[];
  random?: number;
  birth_year?: number;
  name?: string;
}

export type ActressSearchResponse = CommonResponse<Pagination<Actress[]>>;

export function useAVActressSearch(
  params: ListByPaginationRequest<ActressSearchRequest>,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: [params, "av/actress"],
    queryFn: async () => {
      const response = await axios.get<ActressSearchResponse>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/search/actress`,
        {
          params,
          timeout: 10000,
        },
      );
      return response.data;
    },
    enabled: enabled,
  });
}

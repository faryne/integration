import axios from "axios";
import { useQuery } from "@tanstack/react-query";

import type { CommonResponse } from "@/apis/interfaces.ts";
import type {
  NCCCIndex,
  NCCCRecordPagination,
  NCCCRecordSearch,
} from "@/types/nccc.ts";

export function useNCCCIndexes() {
  return useQuery({
    queryKey: ["nccc-indexes"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<NCCCIndex[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/nccc/indexes`,
      );
      return response.data;
    },
  });
}

export function useNCCCRecords(
  token: string | undefined,
  search: NCCCRecordSearch,
) {
  return useQuery({
    queryKey: ["nccc-records", token, search],
    enabled: !!token,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<NCCCRecordPagination>>(
        `${import.meta.env.VITE_API_BASE}/opendata/nccc/indexes/${token}/records`,
        {
          params: {
            ...search,
            yearMonths: search.yearMonths?.join(",") || undefined,
          },
        },
      );
      return response.data;
    },
  });
}

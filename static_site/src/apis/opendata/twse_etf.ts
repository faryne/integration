import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";
import type { TwseEtfInfo } from "@/types/etf.ts";

export function useGetTwseEtfCodeList() {
  return useQuery({
    queryKey: ["opendata/twse/etf_code_list"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfInfo[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/financial/twse/code_list`,
      );
      return response.data;
    },
  });
}

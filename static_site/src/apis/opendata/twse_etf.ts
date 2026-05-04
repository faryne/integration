import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";
import type { TwseEtfInfo, TwseEtfShare } from "@/types/etf.ts";

export function useGetTwseEtfCodeList() {
  return useQuery({
    queryKey: ["opendata/twse/etf_code_list"],
    queryFn: async () => {
      const response = await axios.get<TwseEtfInfo[]>(
        `${import.meta.env.VITE_CDN_BASE}/opendata/twse/etf/code_list.json`,
      );
      return response.data;
    },
  });
}

export function useGetTwseEtfInfo(code: string) {
  return useQuery({
    queryKey: ["opendata/twse/etf_info", code],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfShare[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/financial/twse/share_info/${code}`,
      );
      return response.data;
    },
    enabled: !!code,
  });
}

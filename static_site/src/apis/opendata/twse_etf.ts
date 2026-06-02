import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type {
  TwseEtfInfo,
  TwseEtfShare,
  TwseEtfShareDetail,
  TwseETFTicker,
} from "@/types/etf.ts";
import type { CommonResponse } from "@/apis/interfaces.ts";

export function useGetTwseEtfCodeList() {
  return useQuery({
    queryKey: ["opendata/twse/etf_code_list"],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfInfo[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/financial/twse/code_list`,
        // `${import.meta.env.VITE_CDN_BASE}/opendata/twse/etf/code_list.json`,
      );
      return response.data;
    },
  });
}

export function useGetTwseEtfInfo(code: string) {
  return useQuery({
    queryKey: ["opendata/twse/etf_info", code],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfShareDetail>>(
        `${import.meta.env.VITE_API_BASE}/opendata/financial/twse/${code}/share_info`,
      );
      return response.data;
    },
    enabled: !!code,
  });
}
export function useGetTwseEtfExInfo(date: string, enabled = true) {
  return useQuery({
    queryKey: ["opendata/twse/etf_ex_info", date],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfShare[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/financial/twse/upcoming/by_date`,
        {
          params: {
            date,
          },
        },
      );
      return response.data;
    },
    enabled: enabled && !!date,
  });
}

export function useGetTwseEtfTicker(
  code: string,
  start_date: string,
  end_date: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["opendata/twse/etf_ticker", code, start_date, end_date],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseETFTicker[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/financial/twse/${code}/ticker`,
        {
          params: {
            start_date,
            end_date,
          },
        },
      );
      return response.data;
    },
    enabled: enabled && !!code && !!start_date && !!end_date,
  });
}

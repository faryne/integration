import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type {TwseEtfInfo, TwseEtfShare, TwseEtfUpcomingShare} from "@/types/etf.ts";

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
      const response = await axios.get<TwseEtfShare[]>(
        `${import.meta.env.VITE_CDN_BASE}/opendata/twse/etf/by_stock/${code}.json`,
      );
      return response.data;
    },
    enabled: !!code,
  });
}
export function useGetTwseEtfExInfo(date: string) {
  return useQuery({
    queryKey: ["opendata/twse/etf_info", date],
    queryFn: async () => {
      const d = date.split("-");
      const response = await axios.get<TwseEtfUpcomingShare[]>(
          `${import.meta.env.VITE_CDN_BASE}/opendata/twse/etf/by_daily/${d[0]}/${d[1]}/${date}.json`,
      );
      return response.data;
    },
    enabled: !!date,
  });
}

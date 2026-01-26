import type { CommonResponse } from "@/apis/interfaces.ts";
import type { Actress } from "@/types/av.ts";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface ActressSearchRequest {
  page: number;
  b?: number[];
  w?: number[];
  h?: number[];
  height?: number[];
  random?: number;
}

export type ActressSearchResponse = CommonResponse<Actress[]>;

export function useAVActressSearch(params: ActressSearchRequest) {
  return useQuery({
    queryKey: [params.random, "av/actress"],
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
  });
}

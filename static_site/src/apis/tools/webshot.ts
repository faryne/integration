import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";
import type { Webshot } from "@/types/webshot.ts";

export interface WebshotCreateRequest {
  url: string;
}

export function useCreateWebshot() {
  return useMutation({
    mutationFn: async (input: WebshotCreateRequest) => {
      const response = await axios.post<CommonResponse<Webshot>>(
        `${import.meta.env.VITE_API_BASE}/tools/webshot`,
        input,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 90000,
        },
      );
      return response.data;
    },
  });
}

export function useWebshotHistory(hash?: string, page = 1, perPage = 10) {
  return useQuery({
    queryKey: ["webshot", hash, page, perPage],
    enabled: Boolean(hash),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<Webshot>>(
        `${import.meta.env.VITE_API_BASE}/tools/webshot/${hash}`,
        {
          params: {
            page,
            per_page: perPage,
          },
        },
      );
      return response.data;
    },
  });
}

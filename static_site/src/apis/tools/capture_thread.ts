import type { CommonResponse } from "@/apis/interfaces.ts";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export interface CaptureThreadRequest {
  url: string;
}

export type CaptureThreadResponse = CommonResponse<{ img: string }>;

export function useCaptureThread() {
  return useMutation({
    mutationFn: async (input: CaptureThreadRequest) => {
      try {
        const resp = await axios.post<CaptureThreadResponse>(
          `${import.meta.env.VITE_API_BASE}/tools/threads/oembed_capture`,
          input,
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
        return resp.data;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response) {
          // 強制回傳後端給的 JSON 內容 (包含 500 時的 message)
          return err.response.data as CaptureThreadResponse;
        }
      }
    },
  });
}

import type {CommonResponse} from "@/apis/interfaces.ts";
import {useMutation} from "@tanstack/react-query";
import axios from "axios";

export interface CaptureThreadRequest {
    url: string
}

export type CaptureThreadResponse = CommonResponse<{data: {img: string}}>

export function useCaptureThread() {
    return useMutation({
        mutationFn: async (input: CaptureThreadRequest) => {
            const resp = await axios.post<never, CaptureThreadResponse, CaptureThreadRequest>(
                `${import.meta.env.VITE_API_BASE}/tools/threads/oembed_capture`,
                input,
                {
                    headers: {
                        "Content-Type": "application/json",
                    }
                },
            )
            return resp.data.data
        }
    })
}
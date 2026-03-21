import {useMutation} from "@tanstack/react-query";
import axios from "axios";
import type {CrawlerRule} from "@/types/crawler.ts";

export interface CrawlerExecRequest {
    uri: string
    rules: CrawlerRule[]
}

export function useCrawlerExec() {
    return useMutation({
        mutationFn: async (input: CrawlerExecRequest) => {
            const resp = await axios.post(
                `${import.meta.env.VITE_API_BASE}/tools/crawler/exec`,
                input,
                {
                    headers: {
                        "Content-Type": "application/json",
                    }
                },
            )
            return resp.data
        }
    })
}
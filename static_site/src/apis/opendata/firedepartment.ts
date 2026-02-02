import axios from "axios";
import type {TWArea} from "@/types/twstats";
import type {Event} from "@/types/firedepartment"
import {useQuery} from "@tanstack/react-query";
import type {CommonResponse} from "@/apis/interfaces.ts";

export function useFireDepartmentRealtimeEvents(queryTime: string | number) {
    return useQuery({
        queryKey: ["opendata/fd/realtime_events", queryTime],
        queryFn: async () => {
            const response = await axios.get<CommonResponse<{[K in TWArea]: Event[]}>>(`${import.meta.env.VITE_API_BASE}/opendata/fd/realtime_events?${queryTime}`);
            return response.data;
        },
    })
}
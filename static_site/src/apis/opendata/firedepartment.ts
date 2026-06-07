import axios from "axios";
import type { TWArea } from "@/types/twstats";
import type { Event } from "@/types/firedepartment";
import { useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";

type FireDepartmentRealtimeArea = "all" | TWArea;
type FireDepartmentRealtimeEvents = Partial<Record<TWArea, Event[]>>;

export function useFireDepartmentRealtimeEvents(
  queryTime: string | number,
  area: FireDepartmentRealtimeArea = "all",
) {
  return useQuery({
    queryKey: ["opendata/fd/realtime_events", area, queryTime],
    queryFn: async () => {
      if (area === "all") {
        const response = await axios.get<
          CommonResponse<FireDepartmentRealtimeEvents>
        >(
          `${import.meta.env.VITE_API_BASE}/opendata/fd/realtime_events?${queryTime}`,
        );
        return response.data;
      }

      const response = await axios.get<CommonResponse<Event[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/fd/realtime_events/${area}?${queryTime}`,
      );
      return {
        ...response.data,
        data: {
          [area]: response.data.data,
        },
      } satisfies CommonResponse<FireDepartmentRealtimeEvents>;
    },
  });
}

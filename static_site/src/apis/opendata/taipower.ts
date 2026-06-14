import axios from "axios";
import { useQuery } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import type {
  TaipowerNeighbor,
  TaipowerNeighborSearch,
} from "@/types/taipower.ts";

type NeighborScope =
  | { type: "all" }
  | { type: "cityarea"; value: string }
  | { type: "unit"; value: string };

export function useTaipowerNeighbors(
  search: TaipowerNeighborSearch,
  scope: NeighborScope = { type: "all" },
) {
  return useQuery({
    queryKey: ["taipower-neighbor", scope, search],
    queryFn: async () => {
      const suffix =
        scope.type === "all"
          ? ""
          : `/${scope.type}/${encodeURIComponent(scope.value)}`;
      const response = await axios.get<
        CommonResponse<Pagination<TaipowerNeighbor[]>>
      >(`${import.meta.env.VITE_API_BASE}/taipower/neighbor${suffix}`, {
        params: search,
      });
      return response.data;
    },
  });
}

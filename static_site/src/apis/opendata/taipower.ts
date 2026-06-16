import axios from "axios";
import { useQuery } from "@tanstack/react-query";

import type { CommonResponse, EsPagination } from "@/apis/interfaces.ts";
import type {
  TaipowerNeighbor,
  TaipowerNeighborPagination,
  TaipowerNeighborSearch,
  TaipowerNeighborStatistics,
  TaipowerStatisticGroup,
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
        CommonResponse<
          EsPagination<TaipowerNeighbor[]> & TaipowerNeighborPagination
        >
      >(`${import.meta.env.VITE_API_BASE}/taipower/neighbor${suffix}`, {
        params: {
          ...search,
          yearMonths: search.yearMonths?.join(",") || undefined,
        },
      });
      return response.data;
    },
  });
}

export function useTaipowerNeighborStatistics(groupBy: TaipowerStatisticGroup) {
  return useQuery({
    queryKey: ["taipower-neighbor-statistics", groupBy],
    queryFn: async () => {
      const cdnBase = String(import.meta.env.VITE_CDN_BASE ?? "").replace(
        /\/+$/,
        "",
      );
      const response = await axios.get<TaipowerNeighborStatistics>(
        `${cdnBase}/taipower/neighbor/${groupBy}.json`,
      );
      return response.data;
    },
  });
}

import axios from "axios";
import { useQuery } from "@tanstack/react-query";

import type { CommonResponse, EsPagination } from "@/apis/interfaces.ts";
import type {
  TaipowerNeighbor,
  TaipowerNeighborPagination,
  TaipowerNeighborSearch,
  TaipowerNeighborStatistics,
  TaipowerNeighborManifest,
  TaipowerPurposeStatistics,
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

const cdnBase = String(import.meta.env.VITE_CDN_BASE ?? "").replace(/\/+$/, "");

export function useTaipowerNeighborManifest() {
  return useQuery({
    queryKey: ["taipower-neighbor-manifest"],
    queryFn: async () => {
      const response = await axios.get<TaipowerNeighborManifest>(
        `${cdnBase}/taipower/neighbor/manifest.json`,
      );
      return response.data;
    },
  });
}

export function useTaipowerNeighborStatistics(
  groupBy: TaipowerStatisticGroup,
  file?: string,
) {
  return useQuery({
    queryKey: ["taipower-neighbor-statistics", groupBy, file],
    enabled: !!file,
    queryFn: async () => {
      const response = await axios.get<TaipowerNeighborStatistics>(
        `${cdnBase}/${file}`,
      );
      return response.data;
    },
  });
}

export function useTaipowerPurposeStatistics(file?: string) {
  return useQuery({
    queryKey: ["taipower-neighbor-purpose", file],
    enabled: !!file,
    queryFn: async () => {
      const response = await axios.get<TaipowerPurposeStatistics>(
        `${cdnBase}/${file}`,
      );
      return response.data;
    },
  });
}

export interface TaipowerNeighbor {
  id: number;
  obj_month_id: number;
  cityarea: string;
  unit: string;
  summary: string;
  apply_reason: string;
  cash: number;
  is_tokenize: number;
  obj_year: number;
  obj_month: number;
  created_on: string;
}

export interface TaipowerNeighborSearch {
  keyword?: string;
  yearMonthFrom?: string;
  yearMonthTo?: string;
  costFrom?: number;
  costTo?: number;
  page?: number;
  per_page?: number;
}

export interface TaipowerNeighborPagination {
  total_cash: number;
}

export type TaipowerStatisticGroup = "unit" | "cityarea";

export interface TaipowerNeighborStatisticYear {
  year: number;
  total_cash: number;
}

export interface TaipowerNeighborStatistic {
  rank: number;
  name: string;
  query_name: string;
  total_cash: number;
  years: TaipowerNeighborStatisticYear[];
}

export interface TaipowerNeighborStatistics {
  group_by: TaipowerStatisticGroup;
  generated_at: string;
  data: TaipowerNeighborStatistic[];
}

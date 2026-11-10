export interface TaipowerNeighbor {
  id: number;
  obj_month_id: number;
  cityarea: string;
  source_cityarea?: string;
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
  yearMonths?: string[];
  yearMonthFrom?: string;
  yearMonthTo?: string;
  costFrom?: number;
  costTo?: number;
  sort?: "date_desc" | "cash_asc" | "cash_desc";
  purpose?: TaipowerPurposeKey;
  page?: number;
  per_page?: number;
  cursor?: string;
}

export interface TaipowerNeighborPagination {
  total_cash: number;
}

export type TaipowerStatisticGroup = "unit" | "cityarea";
export type TaipowerPurposeKey =
  | "social_aid"
  | "education"
  | "community"
  | "public_facilities"
  | "energy"
  | "unclassified";

export interface TaipowerNeighborManifest {
  generation_id: string;
  generated_at: string;
  source_latest_month: string;
  indexed_count: number;
  normalization_version: string;
  purpose_rule_version: string;
  files: Record<TaipowerStatisticGroup | "purpose", string>;
}

export interface TaipowerPurposeStatistic {
  year: number;
  cityarea: string;
  purpose: TaipowerPurposeKey;
  count: number;
  total_cash: number;
}

export interface TaipowerPurposeStatistics {
  generated_at: string;
  data: TaipowerPurposeStatistic[];
}

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

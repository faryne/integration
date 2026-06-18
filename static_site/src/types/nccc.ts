import type { EsPagination } from "@/apis/interfaces.ts";

export interface NCCCIndex {
  token: string;
  text: string;
}

export type NCCCRecord = Record<string, string | number | boolean | null>;

export interface NCCCRecordSearch {
  page?: number;
  per_page?: number;
  cursor?: string;
  yearMonths?: string[];
  region?: string;
  category?: string;
  filters?: Record<string, string[]>;
}

export interface NCCCFacetOption {
  value: string;
  count: number;
}

export interface NCCCRecordFacets {
  regions: NCCCFacetOption[];
  categories: NCCCFacetOption[];
  fields: NCCCFieldFacet[];
}

export interface NCCCFieldFacet {
  field: string;
  options: NCCCFacetOption[];
}

export type NCCCRecordPagination = EsPagination<NCCCRecord[]> & {
  index: NCCCIndex;
  facets: NCCCRecordFacets;
};

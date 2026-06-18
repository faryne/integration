import type { EsPagination } from "@/apis/interfaces.ts";

export interface NCCCIndex {
  token: string;
  text: string;
  fields?: Record<string, string>;
  filters?: Record<string, string[]>;
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

export interface NCCCFieldFacet {
  field: string;
  options: string[];
}

export type NCCCRecordPagination = EsPagination<NCCCRecord[]> & {
  index: NCCCIndex;
};

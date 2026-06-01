import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import type { BankName, Rate } from "@/types/rates.ts";

export function useGetCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<{ [k in string]: string }>
      >(`${import.meta.env.VITE_API_BASE}/opendata/rates/currencies`);
      return response.data;
    },
  });
}

export interface GetCurrencyRatesRequest {
  service_name?: BankName;
  begin_date: string;
  end_date?: string;
  currencies?: string[];
}
export function useGetCurrencyRates(params: GetCurrencyRatesRequest) {
  return useQuery({
    queryKey: ["rates", params],
    enabled: Boolean(params.begin_date && params.currencies?.length),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<Rate[]>>(
        `${import.meta.env.VITE_API_BASE}/opendata/rates`,
        {
          params,
          timeout: 10000,
        },
      );
      return response.data;
    },
  });
}

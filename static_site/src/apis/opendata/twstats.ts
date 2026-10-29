import type { TwStatRawData } from "@/types/twstats.ts";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const baseUri = "https://raw.githubusercontent.com/faryne/tw-stats/master/docs";

export type TwStatsByYear = { [key: string]: TwStatRawData };
export type TwStatsByIndex = { [key: string]: string };

export function useGetTwStatsIndex() {
  return useQuery({
    queryKey: ["opendata/twstats/index"],
    queryFn: async () => {
      const response = await axios.get<TwStatsByIndex>(`${baseUri}/index.json`);
      return response.data;
    },
  });
}

// enabled 給「每萬人」換算用：只有開啟換算時才抓人口指標
export function useGetTwStatsByName(name: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [`opendata/twstats/${name}/index`],
    queryFn: async () => {
      const response = await axios.get<TwStatsByYear>(
        `${baseUri}/${name}/index.json`,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );
      return response.data;
    },
  });
}

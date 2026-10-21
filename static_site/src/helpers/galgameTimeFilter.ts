import { useState } from "react";
import { useSearchParams } from "react-router-dom";

// 時間篩選選項（網址參數 ?time=7d / 30d；沒帶就是全部）
export const galgameTimeFilters = ["all", "7d", "30d"] as const;
export type GalgameTimeFilter = (typeof galgameTimeFilters)[number];
const filterDays: Record<GalgameTimeFilter, number> = {
  all: 0,
  "7d": 7,
  "30d": 30,
};

/** 讀寫網址上的時間篩選，並換算成 API 的 published_at_from；切換時一併回到第 1 頁 */
export function useGalgameTimeFilter() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("time");
  const time: GalgameTimeFilter = galgameTimeFilters.includes(
    raw as GalgameTimeFilter,
  )
    ? (raw as GalgameTimeFilter)
    : "all";
  // 進頁時固定一個「現在」，避免每次 render 算出不同時間而讓查詢 key 一直變
  const [now] = useState(() => Date.now());
  const days = filterDays[time];
  const publishedAtFrom = days
    ? new Date(now - days * 86_400_000).toISOString()
    : undefined;
  const setTime = (value: GalgameTimeFilter) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === "all") {
        next.delete("time");
      } else {
        next.set("time", value);
      }
      next.delete("page");
      return next;
    });
  return { time, publishedAtFrom, setTime };
}

/** 讀寫網址上的分頁參數（?page=，第 1 頁不帶） */
export function useGalgamePage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const setPage = (value: number) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value > 1) {
        next.set("page", String(value));
      } else {
        next.delete("page");
      }
      return next;
    });
  return { page, setPage };
}

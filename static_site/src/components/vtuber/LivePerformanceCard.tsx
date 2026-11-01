import { useState } from "react";

import { formatCount, taipeiTime } from "@/components/vtuber/format.ts";
import {
  StatCard,
  StatEmpty,
  StatToggle,
} from "@/components/vtuber/StatCard.tsx";
import { StatChart, type StatPoint } from "@/components/vtuber/StatChart.tsx";
import type { VtuberLiveHistoryItem } from "@/types/vtubers.ts";

type PerfKey = "peak_viewers" | "view_count" | "like_count";
const OPTIONS: [PerfKey, string][] = [
  ["peak_viewers", "同接峰值"],
  ["view_count", "觀看"],
  ["like_count", "按讚"],
];

/**
 * 統計分頁「每場直播」：一場一根長條，可切同接峰值／觀看／按讚；上方是平均與最高。
 * 沒有數值的場次（部署前結束、會員限定、讚數不公開）不畫也不算進平均
 */
export function LivePerformanceCard({
  lives,
}: {
  lives: VtuberLiveHistoryItem[];
}) {
  const [key, setKey] = useState<PerfKey>("peak_viewers");
  const label = OPTIONS.find(([k]) => k === key)![1];
  const points: StatPoint[] = lives.flatMap((l) => {
    const value = l[key];
    if (value == null) return [];
    const t = taipeiTime(l.actual_start_at);
    return [
      {
        // 只拿來顯示 X 軸的月/日，用台北日期建本地 Date，才不會因瀏覽器時區差一天
        date: new Date(`${t.dateKey}T00:00:00`),
        value,
        tooltip: `${t.date} ${t.hm}\n${l.title}\n${label}：${value.toLocaleString()}`,
      },
    ];
  });
  const values = points.map((p) => p.value);
  const avg = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

  return (
    <StatCard
      label={"每場直播"}
      value={avg != null ? `平均 ${formatCount(avg)}` : undefined}
      sub={avg != null && `最高 ${formatCount(Math.max(...values))}`}
      action={
        lives.length > 0 && (
          <StatToggle value={key} options={OPTIONS} onChange={setKey} />
        )
      }
    >
      {lives.length === 0 ? (
        <StatEmpty>沒有直播</StatEmpty>
      ) : points.length > 0 ? (
        <StatChart label={label} points={points} mode={"daily"} discrete />
      ) : (
        <StatEmpty>資料累積中</StatEmpty>
      )}
    </StatCard>
  );
}

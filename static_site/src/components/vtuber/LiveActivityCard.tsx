import { useState } from "react";

import { formatDuration } from "@/components/vtuber/format.ts";
import {
  summarizeLives,
  weeklyLives,
} from "@/components/vtuber/liveHistory.ts";
import {
  StatCard,
  StatEmpty,
  StatToggle,
} from "@/components/vtuber/StatCard.tsx";
import { StatChart } from "@/components/vtuber/StatChart.tsx";
import type { VtuberLiveHistoryItem } from "@/types/vtubers.ts";

type ActivityMode = "count" | "hours";

/** 統計分頁「直播」：期間合計與平均單場長度，每週一根長條可切場次／時數 */
export function LiveActivityCard({
  lives,
  days,
}: {
  lives: VtuberLiveHistoryItem[];
  days: number;
}) {
  const [mode, setMode] = useState<ActivityMode>("count");
  const { count, totalMs } = summarizeLives(lives);
  const points = weeklyLives(lives, days).map(({ week, count, hours }) => {
    const value = mode === "count" ? count : Math.round(hours * 10) / 10;
    return {
      date: week,
      value,
      tooltip: `${week.toLocaleDateString("zh-TW")} 那週\n${value} ${mode === "count" ? "場" : "小時"}`,
    };
  });

  return (
    <StatCard
      label={"直播"}
      value={`${count} 場・${Math.round(totalMs / 3_600_000)} 小時`}
      sub={count > 0 && `平均每場 ${formatDuration(totalMs / count)}`}
      action={
        count > 0 && (
          <StatToggle
            value={mode}
            options={[
              ["count", "場次"],
              ["hours", "時數"],
            ]}
            onChange={setMode}
          />
        )
      }
    >
      {count > 0 ? (
        <StatChart label={"直播"} points={points} mode={"daily"} />
      ) : (
        <StatEmpty>沒有直播</StatEmpty>
      )}
    </StatCard>
  );
}

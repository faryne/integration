import {
  Box,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import {
  useVtuberChannelLiveHistory,
  useVtuberChannelStats,
} from "@/apis/opendata/vtubers.ts";
import { formatCount, formatSignedCount } from "@/components/vtuber/format.ts";
import { LiveActivityCard } from "@/components/vtuber/LiveActivityCard.tsx";
import { LiveHeatmap } from "@/components/vtuber/LiveHeatmap.tsx";
import { trackedLives } from "@/components/vtuber/liveHistory.ts";
import { LivePerformanceCard } from "@/components/vtuber/LivePerformanceCard.tsx";
import {
  StatCard,
  StatEmpty,
  StatToggle,
} from "@/components/vtuber/StatCard.tsx";
import { StatChart, type StatPoint } from "@/components/vtuber/StatChart.tsx";
import type { VtuberStat } from "@/types/vtubers.ts";

type StatKey = "subscriber_count" | "view_count" | "video_count";
type StatMode = "total" | "daily";

// 預設顯示方式依數字特性不同（mode 為 null 表示只顯示目前數字、不畫圖）：
// 訂閱者 API 只給三位有效數字（2.04M 的頻道每 1 萬才跳一格），累計是平線、每日增減幾乎都是 0，畫圖會像沒活動；
// 觀看的累計幾乎是斜直線，看每日增減；影片看累計
const METRICS: { key: StatKey; label: string; mode: StatMode | null }[] = [
  { key: "subscriber_count", label: "訂閱者", mode: null },
  { key: "view_count", label: "觀看", mode: "daily" },
  { key: "video_count", label: "影片", mode: "total" },
];
const RANGES: [number, string][] = [
  [30, "30 天"],
  [90, "90 天"],
  [180, "180 天"],
  [365, "1 年"],
];

interface TalentStatsProps {
  handle: string;
  onError: (error: unknown) => void;
}

/** 藝人頁「統計」分頁：上半是直播統計（場次時數、時段、每場表現），下半是訂閱者、觀看、影片的每日變化 */
export function TalentStats({ handle, onError }: TalentStatsProps) {
  const [days, setDays] = useState(90);
  const [modes, setModes] = useState(
    () =>
      Object.fromEntries(METRICS.map((m) => [m.key, m.mode])) as Record<
        StatKey,
        StatMode | null
      >,
  );
  const query = useVtuberChannelStats(handle, days);
  const history = useVtuberChannelLiveHistory(handle, days);
  const stats = query.data ?? [];
  const lives = history.data && trackedLives(history.data);

  useEffect(() => {
    if (query.error) onError(query.error);
  }, [query.error, onError]);
  useEffect(() => {
    if (history.error) onError(history.error);
  }, [history.error, onError]);

  return (
    <Box>
      <Stack direction={"row"} justifyContent={"flex-end"} sx={{ mb: 1.5 }}>
        <ToggleButtonGroup
          size={"small"}
          exclusive
          value={days}
          onChange={(_, value: number | null) => value && setDays(value)}
        >
          {RANGES.map(([value, label]) => (
            <ToggleButton key={value} value={value} sx={{ px: 1.5 }}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {(query.isFetching || history.isFetching) && (
        <LinearProgress sx={{ mb: 1 }} />
      )}
      {query.data && (
        <Stack spacing={1.75}>
          {/* 直播統計 API 失敗時只少這三張，下面的頻道統計照常顯示 */}
          {lives && (
            <>
              <LiveActivityCard lives={lives} days={days} />
              <LiveHeatmap lives={lives} />
              <LivePerformanceCard lives={lives} />
            </>
          )}
          {METRICS.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              stats={stats}
              statKey={metric.key}
              mode={modes[metric.key]}
              onModeChange={(mode) =>
                setModes((m) => ({ ...m, [metric.key]: mode }))
              }
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function MetricCard({
  label,
  stats,
  statKey,
  mode,
  onModeChange,
}: {
  label: string;
  stats: VtuberStat[];
  statKey: StatKey;
  mode: StatMode | null;
  onModeChange: (mode: StatMode) => void;
}) {
  // 不畫圖的指標也不顯示區間增減，避免出現沒意義的 +0
  const enough = mode != null && stats.length > 1;
  const last = stats.at(-1)?.[statKey] ?? 0;
  const delta = enough ? last - stats[0][statKey] : null;
  // record_date 是台北日期字串，用本地日期建 Date，圖上的日期才不會差一天
  const toDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  };
  // 每日增減：跟前一筆相比；某天 job 沒跑時會是兩天的合計
  const points: StatPoint[] =
    mode === "daily"
      ? stats.slice(1).map((s, i) => ({
          date: toDate(s.record_date),
          value: s[statKey] - stats[i][statKey],
        }))
      : stats.map((s) => ({ date: toDate(s.record_date), value: s[statKey] }));

  return (
    <StatCard
      label={label}
      value={
        statKey === "video_count" ? last.toLocaleString() : formatCount(last)
      }
      delta={
        delta != null && (
          <Typography
            variant={"body2"}
            fontWeight={600}
            sx={{ color: delta >= 0 ? "success.main" : "warning.main" }}
          >
            {formatSignedCount(delta)}
          </Typography>
        )
      }
      action={
        enough && (
          <StatToggle
            value={mode}
            options={[
              ["total", "累計"],
              ["daily", "每日增減"],
            ]}
            onChange={onModeChange}
          />
        )
      }
    >
      {mode == null ? null : enough ? (
        <StatChart label={label} points={points} mode={mode} />
      ) : (
        <StatEmpty>資料累積中（目前 {stats.length} 天）</StatEmpty>
      )}
    </StatCard>
  );
}

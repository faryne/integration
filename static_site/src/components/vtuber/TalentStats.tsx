import {
  Box,
  LinearProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { useVtuberChannelStats } from "@/apis/opendata/vtubers.ts";
import { formatCount, formatSignedCount } from "@/components/vtuber/format.ts";
import { StatChart, type StatPoint } from "@/components/vtuber/StatChart.tsx";
import type { VtuberStat } from "@/types/vtubers.ts";

type StatKey = "subscriber_count" | "view_count" | "video_count";
type StatMode = "total" | "daily";

// 預設顯示方式依數字特性不同：
// 訂閱者只有三位有效數字，大頻道每日增減幾乎都是 0，看累計；觀看的累計幾乎是斜直線，看每日增減；影片看累計
const METRICS: { key: StatKey; label: string; mode: StatMode }[] = [
  { key: "subscriber_count", label: "訂閱者", mode: "total" },
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

/** 藝人頁「統計」分頁：訂閱者、觀看、影片的每日變化 */
export function TalentStats({ handle, onError }: TalentStatsProps) {
  const [days, setDays] = useState(90);
  const [modes, setModes] = useState<Record<StatKey, StatMode>>(
    () =>
      Object.fromEntries(METRICS.map((m) => [m.key, m.mode])) as Record<
        StatKey,
        StatMode
      >,
  );
  const query = useVtuberChannelStats(handle, days);
  const stats = query.data ?? [];

  useEffect(() => {
    if (query.error) onError(query.error);
  }, [query.error, onError]);

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
      {query.isFetching && <LinearProgress sx={{ mb: 1 }} />}
      {query.data && (
        <Stack spacing={1.75}>
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
  mode: StatMode;
  onModeChange: (mode: StatMode) => void;
}) {
  const enough = stats.length > 1;
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
    <Paper variant={"outlined"} sx={{ px: 2, pt: 1.75, pb: 1 }}>
      <Stack
        direction={"row"}
        flexWrap={"wrap"}
        gap={1}
        alignItems={"flex-end"}
        justifyContent={"space-between"}
      >
        <Box>
          <Typography variant={"body2"} color={"text.secondary"}>
            {label}
          </Typography>
          <Stack direction={"row"} spacing={1} alignItems={"baseline"}>
            <Typography variant={"h5"} fontWeight={800}>
              {statKey === "video_count"
                ? last.toLocaleString()
                : formatCount(last)}
            </Typography>
            {delta != null && (
              <Typography
                variant={"body2"}
                fontWeight={600}
                sx={{ color: delta >= 0 ? "success.main" : "warning.main" }}
              >
                {formatSignedCount(delta)}
              </Typography>
            )}
          </Stack>
        </Box>
        {enough && (
          <ToggleButtonGroup
            size={"small"}
            exclusive
            value={mode}
            onChange={(_, value: StatMode | null) =>
              value && onModeChange(value)
            }
          >
            <ToggleButton value={"total"} sx={{ px: 1.25 }}>
              累計
            </ToggleButton>
            <ToggleButton value={"daily"} sx={{ px: 1.25 }}>
              每日增減
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>
      {enough ? (
        <StatChart label={label} points={points} mode={mode} />
      ) : (
        <Typography
          color={"text.secondary"}
          textAlign={"center"}
          sx={{ py: 3 }}
        >
          資料累積中（目前 {stats.length} 天）
        </Typography>
      )}
    </Paper>
  );
}

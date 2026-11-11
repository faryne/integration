import { useState } from "react";
import { Box, Chip, Skeleton, Stack } from "@mui/material";

import { useUpcoming, useUpcomingDates } from "@/apis/av/upcoming.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { jstDatePlus, shortDate } from "@/helpers/upcoming.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeSection } from "./HomeSection.tsx";

const UPCOMING_LIMIT = 12;
const WEEK_DAYS = 7;

type Range = "tomorrow" | "dayAfter" | "week";

// 三個分頁的日期範圍（日本時間；end 不含當天），彼此不重疊：明天、後天、大後天起到第 7 天
const RANGES: { key: Range; label: string; start: number; end: number }[] = [
  { key: "tomorrow", label: "明天", start: 1, end: 2 },
  { key: "dayAfter", label: "後天", start: 2, end: 3 },
  { key: "week", label: "之後", start: 3, end: WEEK_DAYS + 1 },
];

/**
 * 首頁「即將發售」：明天／後天／之後（大後天起到第 7 天）三個不重疊的分頁，各列那段期間 DMM 收藏數前 12 部（只排序、不顯示數字）。
 * 分頁上標日期與部數，預設停在第一個有作品的分頁；7 天內都沒有預約作品時整區不顯示
 */
export function UpcomingSection() {
  const dates = useUpcomingDates({ end_date: jstDatePlus(WEEK_DAYS + 1) });
  const countOf = (r: (typeof RANGES)[number]) =>
    (dates.data ?? [])
      .filter(
        (d) => d.date >= jstDatePlus(r.start) && d.date < jstDatePlus(r.end),
      )
      .reduce((n, d) => n + d.count, 0);
  const [picked, setPicked] = useState<Range>();
  // 還沒選過時，停在第一個有作品的分頁（明天沒有新片就跳到後天或一週內）
  const range =
    RANGES.find((r) => r.key === picked) ??
    RANGES.find((r) => countOf(r) > 0) ??
    RANGES[0];
  const q = useUpcoming({
    start_date: jstDatePlus(range.start),
    end_date: jstDatePlus(range.end),
    sort: "popular",
  });
  const videos = (q.data?.data ?? []).slice(0, UPCOMING_LIMIT);
  if (dates.isSuccess && RANGES.every((r) => countOf(r) === 0)) return null;

  // 「看全部」：帶到即將發售頁這個分頁的第一天
  const moreTo = joyuPath(`upcoming?date=${jstDatePlus(range.start)}`);

  return (
    <HomeSection title="即將發售" moreTo={moreTo}>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
        {RANGES.map((r) => {
          const n = countOf(r);
          const on = r.key === range.key;
          // 單日標日期，「之後」標日期範圍（例：11/14～11/18）
          const day =
            r.key === "week"
              ? ` ${shortDate(jstDatePlus(r.start))}～${shortDate(jstDatePlus(r.end - 1))}`
              : ` ${shortDate(jstDatePlus(r.start))}`;
          return (
            <Chip
              key={r.key}
              clickable
              color={on ? "primary" : "default"}
              disabled={dates.isSuccess && n === 0}
              label={`${r.label}${day}${dates.isSuccess ? `・${n} 部` : ""}`}
              onClick={() => setPicked(r.key)}
              variant={on ? "filled" : "outlined"}
            />
          );
        })}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(6, minmax(0, 1fr))",
          },
        }}
      >
        {q.isPending
          ? Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ height: 260 }} />
            ))
          : videos.map((v) => <VideoCoverCard key={v.no} video={v} />)}
      </Box>
      <ErrorSnack
        open={q.isError || dates.isError}
        message="即將發售資料讀取失敗，請稍後再試"
      />
    </HomeSection>
  );
}

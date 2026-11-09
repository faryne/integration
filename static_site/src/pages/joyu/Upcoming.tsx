import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Chip,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

import {
  useMyUpcoming,
  useUpcoming,
  useUpcomingDates,
} from "@/apis/av/upcoming.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { HolidayCalendar } from "@/components/common/ROCCalendar/HolidayCalendar.tsx";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { jstDatePlus } from "@/helpers/upcoming.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { Video } from "@/types/av.ts";

// 即將發售的範圍：明天起 30 天（跟後端 upcomingDays 一樣）
const UPCOMING_DAYS = 30;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// yyyy-MM-dd → 11/13（五）
const dayLabel = (date: string) => {
  const d = dayjs(date);
  return `${d.month() + 1}/${d.date()}（${WEEKDAYS[d.day()]}）`;
};

function VideoGrid({ videos }: { videos: Video[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
      }}
    >
      {videos.map((v) => (
        <VideoCoverCard key={v.no} video={v} />
      ))}
    </Box>
  );
}

/**
 * joyu 即將發售（/upcoming）：DMM 未來 30 天的預約作品。
 * 「全部」：共通日曆（每天標部數），選一天列出那天的作品（依 DMM 收藏數排序，不顯示數字）；
 * 「我追蹤的」：符合任一筆追蹤的預約作品，依配信日近的在前。
 * 桌機日曆在左（捲動時固定）、作品在右，手機上下排；條件存在網址（?mine=1&date=2026-11-20&page=2）
 */
export function JoyuUpcoming() {
  useTitle("即將發售");
  const { user } = useJoyuAuth();
  const [params, setParams] = useSearchParams();
  const mine = params.get("mine") === "1";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const update = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      return next;
    });

  const dates = useUpcomingDates({});
  const dateList = useMemo(() => dates.data ?? [], [dates.data]);
  // 日曆每天標部數
  const marks = useMemo(
    () => Object.fromEntries(dateList.map((d) => [d.date, `${d.count} 部`])),
    [dateList],
  );
  // 網址有指定日期（範圍內）就照著顯示，沒有作品就是空的；沒指定才預設第一個有作品的日子
  const minDate = dayjs(jstDatePlus(1));
  const maxDate = dayjs(jstDatePlus(UPCOMING_DAYS));
  const rawDate = params.get("date") ?? "";
  const requested = dayjs(rawDate);
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    requested.isValid() &&
    !requested.isBefore(minDate, "day") &&
    !requested.isAfter(maxDate, "day")
      ? requested.format("YYYY-MM-DD")
      : dateList[0]?.date;
  const count = dateList.find((d) => d.date === date)?.count ?? 0;
  const list = useUpcoming(
    date
      ? {
          start_date: date,
          end_date: dayjs(date).add(1, "day").format("YYYY-MM-DD"),
          page,
        }
      : {},
    !mine && !!date,
  );
  const my = useMyUpcoming(mine ? user?.uid : undefined, page);
  const current = mine ? my : list;
  const pageCount = current.data?.last_page ?? 0;

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={2.5} sx={{ textAlign: "left" }}>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
          即將發售
        </Typography>
        <Stack direction="row" gap={0.75}>
          <Chip
            clickable
            color={mine ? "default" : "primary"}
            label="全部"
            onClick={() => update({ mine: undefined })}
            variant={mine ? "outlined" : "filled"}
          />
          <Chip
            clickable
            color={mine ? "primary" : "default"}
            label="我追蹤的"
            onClick={() => update({ mine: "1" })}
            variant={mine ? "filled" : "outlined"}
          />
        </Stack>

        <Box
          sx={{
            alignItems: "start",
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: mine ? "1fr" : "380px 1fr" },
          }}
        >
          {!mine && (
            <Box sx={{ position: { md: "sticky" }, top: { md: 80 } }}>
              {dates.isPending ? (
                <Skeleton height={420} variant="rounded" />
              ) : (
                <HolidayCalendar
                  hideYearNav
                  initialMonth={date ? dayjs(date) : undefined}
                  marks={marks}
                  maxDate={maxDate}
                  minDate={minDate}
                  onClick={(d) => update({ date: d.format("YYYY-MM-DD") })}
                  selectedDate={date}
                />
              )}
            </Box>
          )}

          <Stack spacing={2}>
            {!mine && date && (
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
                {dayLabel(date)}
                {count > 0 && (
                  <Box
                    component="span"
                    sx={{
                      color: "text.secondary",
                      fontSize: 13,
                      fontWeight: 400,
                      ml: 1,
                    }}
                  >
                    {count} 部
                  </Box>
                )}
              </Typography>
            )}
            {current.isFetching && !current.data && (
              <Skeleton height={320} variant="rounded" />
            )}
            {(current.isError || dates.isError) && (
              <Typography color="error">
                即將發售資料讀取失敗，請稍後再試
              </Typography>
            )}
            {((mine && !user) ||
              (current.isSuccess &&
                (current.data?.data ?? []).length === 0)) && (
              <Typography color="text.secondary">目前沒有預約作品</Typography>
            )}
            <VideoGrid videos={current.data?.data ?? []} />
            {pageCount > 1 && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Pagination
                  count={pageCount}
                  onChange={(_, p) =>
                    update({ page: p > 1 ? String(p) : undefined })
                  }
                  page={page}
                  shape="rounded"
                  variant="outlined"
                />
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>
    </AgeConfirmationGate>
  );
}

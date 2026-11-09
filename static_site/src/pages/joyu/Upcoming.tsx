import { useSearchParams } from "react-router-dom";
import {
  Box,
  Chip,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import {
  useMyUpcoming,
  useUpcoming,
  useUpcomingDates,
} from "@/apis/av/upcoming.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { jstDatePlus } from "@/helpers/upcoming.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { Video } from "@/types/av.ts";

const RANGES = [7, 30];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// yyyy-MM-dd → 11/13（五）
const dayLabel = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
};
// yyyy-MM-dd 的隔天（end_date 不含當天）
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function VideoGrid({ videos }: { videos: Video[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(4, minmax(0, 1fr))",
          md: "repeat(6, minmax(0, 1fr))",
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
 * 「全部」：上面是日期列（每天幾部），選一天列出那天的作品（依 DMM 收藏數排序，不顯示數字）；
 * 「我追蹤的」：符合任一筆追蹤的預約作品，依配信日近的在前。條件存在網址（?mine=1&days=30&date=2026-11-20&page=2）
 */
export function JoyuUpcoming() {
  useTitle("即將發售");
  const { user } = useJoyuAuth();
  const [params, setParams] = useSearchParams();
  const mine = params.get("mine") === "1";
  const days = params.get("days") === "30" ? 30 : 7;
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

  const dates = useUpcomingDates({ end_date: jstDatePlus(days + 1) });
  const dateList = dates.data ?? [];
  const date =
    dateList.find((d) => d.date === params.get("date"))?.date ??
    dateList[0]?.date;
  const list = useUpcoming(
    date ? { start_date: date, end_date: nextDay(date), page } : {},
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
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1}
          sx={{ justifyContent: "space-between" }}
          useFlexGap
        >
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
          {!mine && (
            <Stack direction="row" gap={0.75}>
              {RANGES.map((r) => (
                <Chip
                  key={r}
                  clickable
                  color={days === r ? "primary" : "default"}
                  label={`${r} 天`}
                  onClick={() =>
                    update({
                      days: r === 7 ? undefined : String(r),
                      date: undefined,
                    })
                  }
                  variant={days === r ? "filled" : "outlined"}
                />
              ))}
            </Stack>
          )}
        </Stack>

        {!mine && (
          <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 0.5 }}>
            {dates.isPending &&
              Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} height={32} variant="rounded" width={96} />
              ))}
            {dateList.map((d) => (
              <Chip
                key={d.date}
                clickable
                color={d.date === date ? "primary" : "default"}
                label={`${dayLabel(d.date)} ${d.count}`}
                onClick={() => update({ date: d.date })}
                sx={{ flexShrink: 0 }}
                variant={d.date === date ? "filled" : "outlined"}
              />
            ))}
          </Box>
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
          (current.isSuccess && (current.data?.data ?? []).length === 0)) && (
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
    </AgeConfirmationGate>
  );
}

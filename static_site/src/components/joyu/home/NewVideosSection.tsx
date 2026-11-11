import { useState } from "react";
import { Box, Chip, Skeleton, Stack } from "@mui/material";

import { useUpcoming, useUpcomingDates } from "@/apis/av/upcoming.ts";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { jstDatePlus, shortDate } from "@/helpers/upcoming.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeRow } from "./HomeRow.tsx";
import { HomeSection } from "./HomeSection.tsx";
import {
  FOLLOWED_DAYS,
  useFollowedActressVideos,
} from "./useFollowedActressVideos.ts";

// 每個分頁都放兩排，切換時高度不跳
const VIDEO_LIMIT = 12;
const WEEK_DAYS = 7;

type Tab = "followed" | "latest" | "tomorrow" | "dayAfter" | "week";

// 即將發售三個分頁的日期範圍（日本時間；end 不含當天），彼此不重疊：明天、後天、大後天起到第 7 天
const RANGES: {
  key: Exclude<Tab, "followed" | "latest">;
  label: string;
  start: number;
  end: number;
}[] = [
  { key: "tomorrow", label: "明天", start: 1, end: 2 },
  { key: "dayAfter", label: "後天", start: 2, end: 3 },
  { key: "week", label: "之後", start: 3, end: WEEK_DAYS + 1 },
];

/**
 * 首頁「新片」：新上架（已配信、依配信日新到舊，預設）＋即將發售的明天／後天／之後三個分頁。
 * 即將發售依 DMM 收藏數排序（只排序、不顯示數字），分頁上標日期與部數，沒有作品的分頁停用；
 * 只有選到的分頁才抓資料，「看全部」連結跟著分頁走。
 * compact：一屏版首頁用，只放一排可橫向滑動；最前面多一個「追蹤的女優」分頁（原版面是獨立區塊），
 * 有登入且最近 7 天有新片時預設停在這頁
 */
export function NewVideosSection({ compact }: { compact?: boolean }) {
  const followed = useFollowedActressVideos(VIDEO_LIMIT);
  const hasFollowed = !!compact && followed.total > 0;
  // 還沒選過分頁時：有追蹤新片停在追蹤，否則新上架
  const [picked, setTab] = useState<Tab>();
  const tab = picked ?? (hasFollowed ? "followed" : "latest");
  const range = RANGES.find((r) => r.key === tab);

  const dates = useUpcomingDates({ end_date: jstDatePlus(WEEK_DAYS + 1) });
  const countOf = (r: (typeof RANGES)[number]) =>
    (dates.data ?? [])
      .filter(
        (d) => d.date >= jstDatePlus(r.start) && d.date < jstDatePlus(r.end),
      )
      .reduce((n, d) => n + d.count, 0);

  const latest = useAVVideoSearch({ page: 1 }, tab === "latest");
  const upcoming = useUpcoming(
    range
      ? {
          start_date: jstDatePlus(range.start),
          end_date: jstDatePlus(range.end),
          sort: "popular",
        }
      : {},
    !!range,
  );
  const q = range ? upcoming : latest;
  const videos =
    tab === "followed"
      ? followed.videos
      : ((range ? upcoming.data?.data : latest.data?.data?.data) ?? []).slice(
          0,
          VIDEO_LIMIT,
        );
  const pending = tab !== "followed" && q.isPending;

  const more =
    tab === "followed"
      ? {
          to: joyuPath(`me/follows?kind=actress&days=${FOLLOWED_DAYS}`),
          label: "我的追蹤",
        }
      : range
        ? {
            to: joyuPath(`upcoming?date=${jstDatePlus(range.start)}`),
            label: "看全部",
          }
        : { to: joyuPath("video"), label: "影片搜尋" };
  const chipSize = compact ? "small" : "medium";

  return (
    <HomeSection
      dense={compact}
      title="新片"
      moreTo={more.to}
      moreLabel={more.label}
    >
      <Stack
        direction="row"
        gap={0.75}
        sx={{
          flexWrap: compact ? "nowrap" : "wrap",
          mb: compact ? 0.75 : 1.5,
          overflowX: compact ? "auto" : "visible",
          "& > *": { flexShrink: 0 },
        }}
      >
        {hasFollowed && (
          <Chip
            clickable
            color={tab === "followed" ? "primary" : "default"}
            label={`追蹤的女優・${FOLLOWED_DAYS} 天 ${followed.total}`}
            onClick={() => setTab("followed")}
            size={chipSize}
            variant={tab === "followed" ? "filled" : "outlined"}
          />
        )}
        <Chip
          clickable
          color={tab === "latest" ? "primary" : "default"}
          label="新上架"
          onClick={() => setTab("latest")}
          size={chipSize}
          variant={tab === "latest" ? "filled" : "outlined"}
        />
        {RANGES.map((r) => {
          const n = countOf(r);
          const on = r.key === tab;
          // 單日標日期，「之後」標日期範圍（例：11/14～11/18）
          const day =
            r.key === "week"
              ? ` ${shortDate(jstDatePlus(r.start))}～${shortDate(jstDatePlus(r.end - 1))}`
              : ` ${shortDate(jstDatePlus(r.start))}`;
          return (
            <Chip
              clickable
              color={on ? "primary" : "default"}
              disabled={dates.isSuccess && n === 0}
              key={r.key}
              label={`${r.label}${day}${dates.isSuccess ? `・${n} 部` : ""}`}
              onClick={() => setTab(r.key)}
              size={chipSize}
              variant={on ? "filled" : "outlined"}
            />
          );
        })}
      </Stack>
      {compact ? (
        <HomeRow item={{ xs: 88, md: 118 }}>
          {pending
            ? Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} variant="rounded" sx={{ height: 220 }} />
              ))
            : videos.map((v) => (
                <VideoCoverCard
                  key={v.no}
                  titleLines={{ xs: 0, md: 1 }}
                  video={v}
                />
              ))}
        </HomeRow>
      ) : (
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
          {pending
            ? Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} variant="rounded" sx={{ height: 260 }} />
              ))
            : videos.map((v) => <VideoCoverCard key={v.no} video={v} />)}
        </Box>
      )}
      <ErrorSnack
        open={(tab !== "followed" && q.isError) || dates.isError}
        message="新片資料讀取失敗，請稍後再試"
      />
    </HomeSection>
  );
}

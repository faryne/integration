import { Box, ButtonBase, Paper, Stack, Typography } from "@mui/material";

import {
  formatDuration,
  liveStartAt,
  relativeDayName,
  taipeiTime,
} from "@/components/vtuber/format.ts";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { LiveStatusChip } from "@/components/vtuber/LiveStatusChip.tsx";
import type { VtuberLive } from "@/types/vtubers.ts";

interface LiveTimelineProps {
  lives: VtuberLive[];
  // 總覽顯示頭像與頻道名；藝人頁只有一位，不用
  withChannel?: boolean;
  onPlay: (live: VtuberLive) => void;
}

/** 依台北日期分組的直播時間軸；已結束淡化並顯示實際時長，已取消加刪除線 */
export function LiveTimeline({
  lives,
  withChannel = true,
  onPlay,
}: LiveTimelineProps) {
  const days = new Map<string, VtuberLive[]>();
  for (const live of lives) {
    const key = taipeiTime(liveStartAt(live)).dateKey;
    days.set(key, [...(days.get(key) ?? []), live]);
  }
  if (days.size === 0) {
    return (
      <Paper variant={"outlined"} sx={{ p: 3, textAlign: "center" }}>
        <Typography color={"text.secondary"}>沒有排定的直播</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {[...days.entries()].map(([dateKey, items]) => {
        const first = taipeiTime(liveStartAt(items[0]));
        const name = relativeDayName(dateKey);
        const date = `${first.md}（${first.weekday}）`;
        return (
          <Paper key={dateKey} variant={"outlined"} sx={{ overflow: "hidden" }}>
            <Stack
              direction={"row"}
              spacing={1}
              alignItems={"baseline"}
              sx={{ px: 1.75, py: 1, bgcolor: "action.hover" }}
            >
              <Typography fontWeight={700} fontSize={14}>
                {name || date}
              </Typography>
              {name && (
                <Typography variant={"body2"} color={"text.secondary"}>
                  {date}
                </Typography>
              )}
              <Typography
                variant={"body2"}
                color={"text.secondary"}
                sx={{ ml: "auto" }}
              >
                {items.length} 場
              </Typography>
            </Stack>
            {items.map((live) => (
              <TimelineRow
                key={live.video_id}
                live={live}
                withChannel={withChannel}
                onPlay={onPlay}
              />
            ))}
          </Paper>
        );
      })}
    </Stack>
  );
}

function TimelineRow({
  live,
  withChannel,
  onPlay,
}: {
  live: VtuberLive;
  withChannel: boolean;
  onPlay: (live: VtuberLive) => void;
}) {
  const start = liveStartAt(live);
  const muted = live.status === "ended" || live.status === "cancelled";
  const duration =
    live.actual_end_at && live.actual_start_at
      ? `直播 ${formatDuration(Date.parse(live.actual_end_at) - Date.parse(live.actual_start_at))}`
      : "";
  const meta = [withChannel ? live.channel_title : "", duration]
    .filter(Boolean)
    .join("・");
  return (
    <ButtonBase
      onClick={() => onPlay(live)}
      sx={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: withChannel
          ? { xs: "48px 1fr auto", sm: "64px 36px 1fr auto" }
          : { xs: "48px 1fr auto", sm: "64px 1fr auto" },
        gap: { xs: 1.25, sm: 1.5 },
        alignItems: "center",
        textAlign: "left",
        px: 1.75,
        py: 1.25,
        borderTop: 1,
        borderColor: "divider",
        opacity: muted ? 0.6 : 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography
        fontWeight={600}
        sx={{ fontFamily: "monospace", fontSize: 15 }}
      >
        {taipeiTime(start).hm}
      </Typography>
      {withChannel && (
        <ChannelAvatar
          src={live.channel_thumbnail_url}
          sx={{ display: { xs: "none", sm: "flex" } }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          fontSize={14}
          sx={{
            textDecoration:
              live.status === "cancelled" ? "line-through" : "none",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: { xs: 2, sm: 1 },
            WebkitBoxOrient: "vertical",
          }}
        >
          {live.title}
        </Typography>
        {meta && (
          <Typography variant={"body2"} color={"text.secondary"} noWrap>
            {meta}
          </Typography>
        )}
      </Box>
      <LiveStatusChip status={live.status} />
    </ButtonBase>
  );
}

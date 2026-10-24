import {
  Box,
  ButtonBase,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";

import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { TimeZoneNote } from "@/components/vtuber/TimeZoneNote.tsx";
import {
  formatDuration,
  liveStartAt,
  taipeiTime,
} from "@/components/vtuber/format.ts";
import type { VtuberLive } from "@/types/vtubers.ts";

export interface PastLiveDay {
  name: string; // 昨天／前天
  dateKey: string; // 2026-10-23
  lives: VtuberLive[];
}

interface PastLivesProps {
  days: PastLiveDay[];
  onPlay: (live: VtuberLive) => void;
}

/**
 * 總覽「過去的直播」：昨天、前天各一組，預設收合，讓錯過的人直接點開存檔。
 * 刻意低調：標題小一號、文字淡一階、縮圖略透明，不搶「直播中」「即將直播」的版面。
 */
export function PastLives({ days, onPlay }: PastLivesProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (dateKey: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(dateKey)) next.add(dateKey);
      return next;
    });
  const visible = days.filter((d) => d.lives.length > 0);
  if (visible.length === 0) return null;

  return (
    <Box>
      <Stack
        direction={"row"}
        spacing={1}
        alignItems={"baseline"}
        sx={{ mb: 1.25 }}
      >
        <Typography fontSize={15} fontWeight={600} color={"text.secondary"}>
          過去的直播
        </Typography>
        <TimeZoneNote />
      </Stack>
      <Stack spacing={1.25}>
        {visible.map((day) => {
          const expanded = open.has(day.dateKey);
          const first = taipeiTime(`${day.dateKey}T12:00:00+08:00`);
          return (
            <Paper
              key={day.dateKey}
              variant={"outlined"}
              sx={{ overflow: "hidden" }}
            >
              <ButtonBase
                onClick={() => toggle(day.dateKey)}
                aria-expanded={expanded}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  gap: 1,
                  px: 1.75,
                  py: 1.25,
                  color: "text.secondary",
                  fontSize: 14,
                }}
              >
                <Typography
                  component={"span"}
                  fontWeight={600}
                  color={"text.primary"}
                  fontSize={14}
                >
                  {day.name}
                </Typography>
                {first.date}（{first.weekday}）
                <Typography
                  component={"span"}
                  fontSize={12.5}
                  color={"text.disabled"}
                  sx={{ ml: "auto" }}
                >
                  {day.lives.length} 場
                </Typography>
                <ExpandMoreIcon
                  fontSize={"small"}
                  sx={{
                    color: "text.disabled",
                    transition: "transform .15s",
                    transform: expanded ? "rotate(180deg)" : "none",
                  }}
                />
              </ButtonBase>
              <Collapse in={expanded} unmountOnExit>
                {day.lives.map((live) => (
                  <PastLiveRow
                    key={live.video_id}
                    live={live}
                    onPlay={onPlay}
                  />
                ))}
              </Collapse>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}

function PastLiveRow({
  live,
  onPlay,
}: {
  live: VtuberLive;
  onPlay: (live: VtuberLive) => void;
}) {
  const duration =
    live.actual_start_at && live.actual_end_at
      ? formatDuration(
          Date.parse(live.actual_end_at) - Date.parse(live.actual_start_at),
        )
      : null;
  return (
    <ButtonBase
      onClick={() => onPlay(live)}
      sx={{
        width: "100%",
        display: "grid",
        // 手機拿掉時間欄，標題可以兩行
        gridTemplateColumns: { xs: "72px 1fr", sm: "48px 80px 1fr" },
        gap: 1.5,
        alignItems: "center",
        textAlign: "left",
        px: 1.75,
        py: 1,
        borderTop: 1,
        borderColor: "divider",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography
        sx={{
          display: { xs: "none", sm: "block" },
          fontFamily: "monospace",
          fontSize: 13,
          color: "text.disabled",
        }}
      >
        {taipeiTime(liveStartAt(live)).hm}
      </Typography>
      <Box
        sx={{
          aspectRatio: "16 / 9",
          borderRadius: 0.5,
          opacity: 0.85,
          bgcolor: "action.hover",
          backgroundImage: `url(${live.thumbnail_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          fontSize={13.5}
          color={"text.secondary"}
          sx={{
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: { xs: 2, sm: 1 },
            WebkitBoxOrient: "vertical",
          }}
        >
          {live.title}
        </Typography>
        <Stack
          direction={"row"}
          spacing={0.75}
          alignItems={"center"}
          sx={{ mt: 0.25, minWidth: 0 }}
        >
          <ChannelAvatar
            src={live.channel_thumbnail_url}
            sx={{ width: 16, height: 16 }}
          />
          <Typography
            fontSize={12}
            color={"text.disabled"}
            noWrap
            sx={{ minWidth: 0 }}
          >
            {live.channel_title}
          </Typography>
          {duration && (
            <Typography
              fontSize={12}
              color={"text.disabled"}
              sx={{ flexShrink: 0 }}
            >
              ・直播 {duration}
            </Typography>
          )}
        </Stack>
      </Box>
    </ButtonBase>
  );
}

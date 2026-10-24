import {
  Box,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import {
  useVtuberChannels,
  useVtuberEndedLives,
  useVtuberLives,
} from "@/apis/opendata/vtubers.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  ALL_CALENDAR_ID,
  calendarLinks,
} from "@/components/vtuber/calendar.ts";
import { CalendarSubscribeMenu } from "@/components/vtuber/CalendarSubscribeMenu.tsx";
import {
  fromToday,
  liveStartAt,
  livePlayingVideo,
  shiftDateKey,
  taipeiTime,
} from "@/components/vtuber/format.ts";
import { LiveCarousel } from "@/components/vtuber/LiveCarousel.tsx";
import { LiveTimeline } from "@/components/vtuber/LiveTimeline.tsx";
import { PastLives } from "@/components/vtuber/PastLives.tsx";
import { TalentPicker } from "@/components/vtuber/TalentPicker.tsx";
import { TimeZoneNote } from "@/components/vtuber/TimeZoneNote.tsx";
import { useNow } from "@/components/vtuber/useNow.ts";
import { useVtuberSnack } from "@/components/vtuber/useVtuberSnack.ts";
import { useOpenVideo } from "@/components/vtuber/routes.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { VtuberLive } from "@/types/vtubers.ts";

/** /data/vtubers 總覽：藝人選擇列、直播中輪播、過去的直播（昨天、前天）、依日期分組的即將直播 */
export function VtubersIndex() {
  useTitle("VTuber 直播行事曆");
  const channels = useVtuberChannels();
  const lives = useVtuberLives();
  const { snack, showError, showCopied, close } = useVtuberSnack();
  const [showCancelled, setShowCancelled] = useState(false);
  const openVideo = useOpenVideo();
  const now = useNow();
  // 過去的直播：查前天 00:00 ～今天 00:00（台北）已結束的
  const today = taipeiTime(new Date(now)).dateKey;
  const yesterday = shiftDateKey(today, -1);
  const dayBefore = shiftDateKey(today, -2);
  const ended = useVtuberEndedLives(dayBefore, today);

  useEffect(() => {
    const error = channels.error ?? lives.error ?? ended.error;
    if (error) showError(error);
  }, [channels.error, lives.error, ended.error, showError]);

  const all = lives.data?.lives ?? [];
  const live = all.filter((l) => l.status === "live");
  const rest = fromToday(all, now).filter(
    (l) => l.status !== "live" && (showCancelled || l.status !== "cancelled"),
  );
  const play = (l: VtuberLive) => openVideo(livePlayingVideo(l));
  // API 回傳跟區間重疊的直播，會混進更早開播、跨日才結束的；依開播日期分到昨天／前天，其餘丟掉
  const endedOn = (dateKey: string) =>
    (ended.data?.lives ?? []).filter(
      (l) => taipeiTime(liveStartAt(l)).dateKey === dateKey,
    );
  const pastDays = [
    { name: "昨天", dateKey: yesterday, lives: endedOn(yesterday) },
    { name: "前天", dateKey: dayBefore, lives: endedOn(dayBefore) },
  ];

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={"row"}
        flexWrap={"wrap"}
        gap={1.5}
        alignItems={"center"}
        justifyContent={"space-between"}
      >
        <Typography variant={"h4"} fontWeight={800}>
          VTuber 直播行事曆
        </Typography>
        <CalendarSubscribeMenu
          calendar={calendarLinks(ALL_CALENDAR_ID)}
          label={"訂閱總表"}
          onCopied={showCopied}
        />
      </Stack>

      {(channels.isLoading || lives.isLoading) && <LinearProgress />}
      {channels.data && <TalentPicker list={channels.data} />}

      {live.length > 0 && (
        <Box>
          <Typography
            variant={"h6"}
            fontWeight={700}
            sx={{ mb: 1.25 }}
            color={"error"}
          >
            ● 直播中 {live.length}
          </Typography>
          {/* 一排輪播：場次再多高度也固定；上方藝人列已經列出所有直播中的藝人，這裡只負責推薦 */}
          <LiveCarousel lives={live} onPlay={play} />
        </Box>
      )}

      <PastLives days={pastDays} onPlay={play} />

      <Box>
        <Stack
          direction={"row"}
          alignItems={"center"}
          justifyContent={"space-between"}
          sx={{ mb: 1.25 }}
        >
          <Stack direction={"row"} spacing={1} alignItems={"baseline"}>
            <Typography variant={"h6"} fontWeight={700}>
              即將直播
            </Typography>
            <TimeZoneNote />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                size={"small"}
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
              />
            }
            label={"顯示已取消"}
          />
        </Stack>
        {lives.data && <LiveTimeline lives={rest} onPlay={play} />}
      </Box>

      <CustomSnackbar
        open={snack.open}
        message={snack.message}
        severity={snack.severity}
        onClose={close}
      />
    </Stack>
  );
}

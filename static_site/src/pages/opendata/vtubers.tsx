import {
  Box,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { useVtuberChannels, useVtuberLives } from "@/apis/opendata/vtubers.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  ALL_CALENDAR_ID,
  calendarLinks,
} from "@/components/vtuber/calendar.ts";
import { CalendarSubscribeMenu } from "@/components/vtuber/CalendarSubscribeMenu.tsx";
import { fromToday, livePlayingVideo } from "@/components/vtuber/format.ts";
import { LiveCarousel } from "@/components/vtuber/LiveCarousel.tsx";
import { LiveTimeline } from "@/components/vtuber/LiveTimeline.tsx";
import { TalentPicker } from "@/components/vtuber/TalentPicker.tsx";
import { useNow } from "@/components/vtuber/useNow.ts";
import { useVtuberSnack } from "@/components/vtuber/useVtuberSnack.ts";
import { VideoModal } from "@/components/vtuber/VideoModal.tsx";
import { useTitle } from "@/helpers/title.tsx";
import type { VtuberLive, VtuberPlayingVideo } from "@/types/vtubers.ts";

/** /data/vtubers 總覽：藝人選擇列、直播中卡片、依日期分組的即將直播 */
export function VtubersIndex() {
  useTitle("VTuber 直播行事曆");
  const channels = useVtuberChannels();
  const lives = useVtuberLives();
  const { snack, showError, showCopied, close } = useVtuberSnack();
  const [showCancelled, setShowCancelled] = useState(false);
  const [playing, setPlaying] = useState<VtuberPlayingVideo | null>(null);
  const now = useNow();

  useEffect(() => {
    const error = channels.error ?? lives.error;
    if (error) showError(error);
  }, [channels.error, lives.error, showError]);

  const all = lives.data?.lives ?? [];
  const live = all.filter((l) => l.status === "live");
  const rest = fromToday(all, now).filter(
    (l) => l.status !== "live" && (showCancelled || l.status !== "cancelled"),
  );
  const play = (l: VtuberLive) => setPlaying(livePlayingVideo(l));

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

      <Box>
        <Stack
          direction={"row"}
          alignItems={"center"}
          justifyContent={"space-between"}
          sx={{ mb: 1.25 }}
        >
          <Typography variant={"h6"} fontWeight={700}>
            即將直播
          </Typography>
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

      <VideoModal video={playing} onClose={() => setPlaying(null)} />
      <CustomSnackbar
        open={snack.open}
        message={snack.message}
        severity={snack.severity}
        onClose={close}
      />
    </Stack>
  );
}

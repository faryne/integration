import {
  Box,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  useVtuberChannel,
  useVtuberChannels,
  useVtuberLives,
} from "@/apis/opendata/vtubers.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { SITE_HEADER_HEIGHT } from "@/components/common/siteLayout/siteTheme.ts";
import {
  fromToday,
  livePlayingVideo,
  relativeDayName,
  taipeiTime,
} from "@/components/vtuber/format.ts";
import { LiveCard } from "@/components/vtuber/LiveCard.tsx";
import { LiveTimeline } from "@/components/vtuber/LiveTimeline.tsx";
import { TalentPicker } from "@/components/vtuber/TalentPicker.tsx";
import { TalentProfile } from "@/components/vtuber/TalentProfile.tsx";
import { TalentStats } from "@/components/vtuber/TalentStats.tsx";
import { TimeZoneNote } from "@/components/vtuber/TimeZoneNote.tsx";
import { TalentVideos } from "@/components/vtuber/TalentVideos.tsx";
import { useNow } from "@/components/vtuber/useNow.ts";
import { useVtuberSnack } from "@/components/vtuber/useVtuberSnack.ts";
import {
  TALENT_TABS,
  type TalentTab,
  talentPath,
  useOpenVideo,
} from "@/components/vtuber/routes.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { VtuberLive, VtuberVideo } from "@/types/vtubers.ts";

/**
 * /data/vtubers/:handle/* 藝人頁：左側個人檔案，右側正在直播＋即將直播／所有影片／行事曆／統計。
 * 分頁由網址決定（/videos、/calendar、/stats），重新整理、分享、上一頁都回到同一個分頁；影片網址 /videos/:videoId 停在所有影片
 */
export function VtuberTalent({
  onNotFound,
}: {
  onNotFound: (error: unknown) => void; // 找不到藝人：由上層跳 snack 並回總覽
}) {
  const { handle = "", "*": rest = "" } = useParams();
  const navigate = useNavigate();
  const channels = useVtuberChannels();
  const detail = useVtuberChannel(handle);
  const channel = detail.data;
  const lives = useVtuberLives(channel?.channel_id, Boolean(channel));
  useTitle(
    channel ? `${channel.title}｜VTuber 直播行事曆` : "VTuber 直播行事曆",
  );

  const { snack, showError, showCopied, close } = useVtuberSnack();
  const [showCancelled, setShowCancelled] = useState(false);
  const openVideo = useOpenVideo();
  const now = useNow();
  const tabsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const notFound =
    axios.isAxiosError(detail.error) && detail.error.response?.status === 404;
  useEffect(() => {
    const error =
      (notFound ? null : detail.error) ?? channels.error ?? lives.error;
    if (error) showError(error);
  }, [notFound, detail.error, channels.error, lives.error, showError]);

  useEffect(() => {
    if (notFound) onNotFound(detail.error);
  }, [notFound, detail.error, onNotFound]);

  if (notFound) return null;

  // 不認得的分頁、或這位藝人沒有行事曆，都回到預設分頁
  const section = TALENT_TABS.find((t) => t === rest.split("/")[0]);
  const tab: TalentTab =
    !section || (section === "calendar" && channel && !channel.calendar)
      ? "upcoming"
      : section;
  const all = channel ? (lives.data?.lives ?? []) : [];
  const live = all.find((l) => l.status === "live");
  const upcoming = fromToday(all, now).filter(
    (l) => l.status !== "live" && (showCancelled || l.status !== "cancelled"),
  );
  const playLive = (l: VtuberLive) => openVideo(livePlayingVideo(l));
  // 分頁列已經黏在 header 下方（代表已經往下捲）時，切換分頁順便捲回內容頂端，不用再爬回去
  const changeTab = (value: TalentTab) => {
    navigate(talentPath(handle, value));
    const tabs = tabsRef.current;
    const header = document.querySelector("header")?.offsetHeight ?? 0;
    if (tabs && tabs.getBoundingClientRect().top <= header + 1) {
      const contentTop = contentRef.current?.getBoundingClientRect().top ?? 0;
      window.scrollTo({ top: window.scrollY + contentTop - header });
    }
  };
  const playVideo = (v: VtuberVideo, vertical: boolean) => {
    const published = taipeiTime(v.published_at);
    openVideo({
      videoId: v.video_id,
      title: v.title,
      channelTitle: channel?.title ?? "",
      channelThumbnailUrl: channel?.thumbnail_url ?? "",
      channelHandle: channel?.handle ?? handle,
      when: relativeDayName(published.dateKey) || published.md,
      vertical,
    });
  };

  return (
    <Stack spacing={2.5}>
      {channels.data && (
        <TalentPicker list={channels.data} currentHandle={handle} />
      )}
      {(detail.isLoading || channels.isLoading) && <LinearProgress />}

      {channel && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <TalentProfile channel={channel} onCopied={showCopied} />

          <Box ref={contentRef} sx={{ minWidth: 0 }}>
            {live && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant={"h6"}
                  fontWeight={700}
                  color={"error"}
                  sx={{ mb: 1.25 }}
                >
                  ● 正在直播
                </Typography>
                <LiveCard live={live} large onPlay={playLive} />
              </Box>
            )}
            {/* 分頁列捲到 header 下方就黏住，捲很多頁後不用爬回去切換 */}
            <Tabs
              ref={tabsRef}
              value={tab}
              onChange={(_, value: TalentTab) => changeTab(value)}
              variant={"scrollable"}
              sx={{
                mb: 2,
                borderBottom: 1,
                borderColor: "divider",
                position: "sticky",
                top: SITE_HEADER_HEIGHT,
                zIndex: (theme) => theme.zIndex.appBar - 1,
                bgcolor: "background.default",
              }}
            >
              <Tab value={"upcoming"} label={"即將直播"} />
              <Tab value={"videos"} label={"所有影片"} />
              {channel.calendar && <Tab value={"calendar"} label={"行事曆"} />}
              <Tab value={"stats"} label={"統計"} />
            </Tabs>

            {tab === "upcoming" && (
              <>
                <Stack
                  direction={"row"}
                  justifyContent={"space-between"}
                  alignItems={"center"}
                >
                  <TimeZoneNote />
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
                {lives.data && (
                  <LiveTimeline
                    lives={upcoming}
                    withChannel={false}
                    onPlay={playLive}
                  />
                )}
              </>
            )}
            {tab === "videos" && (
              <TalentVideos
                handle={handle}
                onPlay={playVideo}
                onError={showError}
              />
            )}
            {tab === "stats" && (
              <TalentStats handle={handle} onError={showError} />
            )}
            {tab === "calendar" && channel.calendar && (
              <Box
                component={"iframe"}
                src={channel.calendar.embed_url}
                title={`${channel.title} 行事曆`}
                sx={{
                  width: "100%",
                  height: 600,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "common.white",
                }}
              />
            )}
          </Box>
        </Box>
      )}

      <CustomSnackbar
        open={snack.open}
        message={snack.message}
        severity={snack.severity}
        onClose={close}
      />
    </Stack>
  );
}

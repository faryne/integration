import { Box, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { formatDuration } from "@/components/vtuber/format.ts";
import { WallControlButton } from "@/components/vtuber/wall/WallControlButton.tsx";
import {
  createYouTubePlayer,
  type YouTubePlayer,
} from "@/components/vtuber/wall/youtubeIframeApi.ts";
import type { VtuberWallVideo } from "@/types/vtubers.ts";

// 播放器回這些錯誤代表看不到（不存在／私人、關閉嵌入），從牆上移除
const UNAVAILABLE_ERRORS = [100, 101, 150];

interface WallTileProps {
  video: VtuberWallVideo;
  muted: boolean;
  userPaused: boolean; // 使用者按了這一格的暫停
  paused: boolean; // 實際要不要暫停：使用者暫停，或別格全螢幕時依常數暫停
  focused: boolean;
  now: number;
  onToggleSound: (videoId: string) => void;
  onTogglePause: (videoId: string) => void;
  onRemove: (videoId: string) => void;
  onFocus: (tile: HTMLElement) => void;
  onExitFocus: () => void;
  onUnavailable: (videoId: string) => void;
}

/**
 * 電視牆的一格：YouTube 播放器（不顯示原生控制列）＋上面一層接點擊的遮罩，點一下整格全螢幕。
 * 播放器只在掛載時建立一次，靜音／暫停透過 IFrame API 切換，不會重新載入。
 */
export function WallTile({
  video,
  muted,
  userPaused,
  paused,
  focused,
  now,
  onToggleSound,
  onTogglePause,
  onRemove,
  onFocus,
  onExitFocus,
  onUnavailable,
}: WallTileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  // 最新的靜音／暫停狀態與錯誤回呼，給播放器 ready 或出錯時讀；放 ref 才不會因為它們變動就重建播放器
  const stateRef = useRef({ muted, paused, onUnavailable });
  useLayoutEffect(() => {
    stateRef.current = { muted, paused, onUnavailable };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // YT.Player 會把傳入的元素換成 iframe，另外建一個子元素給它，React 管的節點才不會被換掉
    const target = document.createElement("div");
    host.append(target);
    let cancelled = false;
    createYouTubePlayer(
      target,
      {
        videoId: video.videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          disablekb: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: ({ target: player }) => {
            playerRef.current = player;
            applyState(player, stateRef.current);
          },
          onError: ({ data }) => {
            if (UNAVAILABLE_ERRORS.includes(data))
              stateRef.current.onUnavailable(video.videoId);
          },
        },
      },
      () => cancelled,
    ).then((player) => {
      if (cancelled) player?.destroy();
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [video.videoId]);

  useEffect(() => {
    if (playerRef.current) applyState(playerRef.current, { muted, paused });
  }, [muted, paused]);

  const since = video.startedAt
    ? `已開播 ${formatDuration(now - Date.parse(video.startedAt))}`
    : "";
  // 暫停、聲音兩顆：平常只在 hover 出現，開著的狀態（暫停中、有聲音）就一直顯示
  const controls = (size: "small" | "medium") => (
    <>
      <WallControlButton
        size={size}
        label={userPaused ? "繼續播放" : "暫停"}
        icon={
          userPaused ? (
            <PlayArrowIcon fontSize={"small"} />
          ) : (
            <PauseIcon fontSize={"small"} />
          )
        }
        active={userPaused}
        className={userPaused ? undefined : "wall-hover"}
        onClick={() => onTogglePause(video.videoId)}
      />
      <WallControlButton
        size={size}
        label={muted ? "開啟聲音" : "關閉聲音"}
        icon={
          muted ? (
            <VolumeOffIcon fontSize={"small"} />
          ) : (
            <VolumeUpIcon fontSize={"small"} />
          )
        }
        active={!muted}
        className={muted ? "wall-hover" : undefined}
        onClick={() => onToggleSound(video.videoId)}
      />
    </>
  );

  return (
    <Box
      ref={tileRef}
      data-video-id={video.videoId}
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "#0b0b0b",
        // 開了聲音的格子外框亮起來，一眼看得出哪幾路有聲音
        outline: muted || focused ? "none" : "3px solid",
        outlineColor: "primary.main",
        outlineOffset: "-3px",
        "& .wall-hover": { opacity: 0, transition: "opacity .15s" },
        "&:hover .wall-hover": { opacity: 1 },
      }}
    >
      <Box
        ref={hostRef}
        sx={{
          position: "absolute",
          inset: 0,
          "& iframe": { width: "100%", height: "100%", border: 0 },
        }}
      />
      {/* 遮罩接點擊：iframe 會吃掉點擊事件，不蓋一層就沒辦法點格子全螢幕 */}
      <Box
        onClick={() => !focused && tileRef.current && onFocus(tileRef.current)}
        sx={{
          position: "absolute",
          inset: 0,
          cursor: focused ? "default" : "pointer",
        }}
      />
      {/* 暫停中的格子變暗，跟播放中的分得出來 */}
      {userPaused && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,.45)",
            pointerEvents: "none",
          }}
        />
      )}
      {video.startedAt && !focused && <LiveBadge />}
      {focused ? (
        <Overlay top>
          <ChannelAvatar
            src={video.channelThumbnailUrl}
            sx={{ width: 32, height: 32 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {video.title}
            </Typography>
            <Typography variant={"body2"} sx={{ opacity: 0.8 }} noWrap>
              {[video.channelTitle, since].filter(Boolean).join("・")}
            </Typography>
          </Box>
          {controls("medium")}
          <WallControlButton
            size={"medium"}
            label={"關閉"}
            icon={<CloseIcon />}
            onClick={onExitFocus}
          />
        </Overlay>
      ) : (
        <>
          <Stack
            direction={"row"}
            spacing={0.5}
            sx={{ position: "absolute", top: 6, right: 6 }}
          >
            {controls("small")}
            {/* 移除：從牆上拿掉、後面的往前補；標題列可以還原，不跳確認 */}
            <WallControlButton
              label={"從電視牆移除"}
              icon={<RemoveCircleOutlineIcon fontSize={"small"} />}
              className={"wall-hover"}
              onClick={() => onRemove(video.videoId)}
            />
          </Stack>
          <Overlay>
            <ChannelAvatar
              src={video.channelThumbnailUrl}
              sx={{ width: 18, height: 18 }}
            />
            <Typography fontSize={12} noWrap sx={{ minWidth: 0 }}>
              {video.channelTitle}
            </Typography>
            <Typography
              fontSize={12}
              sx={{ ml: "auto", flexShrink: 0, opacity: 0.85 }}
            >
              {since}
            </Typography>
          </Overlay>
        </>
      )}
    </Box>
  );
}

function applyState(
  player: YouTubePlayer,
  { muted, paused }: { muted: boolean; paused: boolean },
) {
  if (muted) player.mute();
  else player.unMute();
  if (paused) player.pauseVideo();
  else player.playVideo();
}

function LiveBadge() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: 6,
        left: 6,
        px: 0.6,
        borderRadius: 0.5,
        bgcolor: "error.main",
        color: "common.white",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        pointerEvents: "none",
      }}
    >
      LIVE
    </Box>
  );
}

// hover 才出現的資訊列：一般格子在下方（頻道・已開播），全螢幕時在上方（標題＋聲音＋關閉）
function Overlay({ top, children }: { top?: boolean; children: ReactNode }) {
  return (
    <Stack
      className={"wall-hover"}
      direction={"row"}
      alignItems={"center"}
      spacing={top ? 1.5 : 0.75}
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        [top ? "top" : "bottom"]: 0,
        px: top ? 2.5 : 1,
        py: top ? 2 : 0.75,
        [top ? "pb" : "pt"]: top ? 5 : 2.25,
        color: "common.white",
        background: `linear-gradient(${top ? "rgba(0,0,0,.75), transparent" : "transparent, rgba(0,0,0,.8)"})`,
        // 下方資訊列不擋點擊（點了要全螢幕）；上方控制列要能按按鈕
        pointerEvents: top ? "auto" : "none",
      }}
    >
      {children}
    </Stack>
  );
}

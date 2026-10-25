import { Box, Button, Stack, Typography } from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useCallback, useEffect, useRef, useState } from "react";

import { useNow } from "@/components/vtuber/useNow.ts";
import { useWallLayout } from "@/components/vtuber/wall/wallGrid.ts";
import { WallTile } from "@/components/vtuber/wall/WallTile.tsx";
import type { VtuberWallVideo } from "@/types/vtubers.ts";

// 全螢幕看某一路時，其他格要不要繼續（靜音）播放；效能不夠時改成 false 讓其他格暫停
const KEEP_OTHERS_PLAYING_ON_FOCUS = true;

interface VideoWallProps {
  title: string;
  countLabel: string; // 「直播中」之類，接在數量前面
  videos: VtuberWallVideo[]; // 已排好順序；之後「自選多部存檔」也是傳一份清單進來
}

/**
 * 電視牆：只吃影片清單，不管資料從哪來。格數依牆的大小（5×5～9×9），多出來的影片不顯示、空格留黑。
 * 全部預設靜音、各自切換聲音；點一格用 Fullscreen API 原地放大（不搬動 iframe，不會斷流）。
 */
export function VideoWall({ title, countLabel, videos }: VideoWallProps) {
  const wallRef = useRef<HTMLDivElement>(null);
  const { style, grid } = useWallLayout(wallRef);
  const [unmuted, setUnmuted] = useState<Set<string>>(new Set());
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const now = useNow();

  // 全螢幕的是哪一格：Esc、瀏覽器按鈕退出時也會觸發，狀態跟著瀏覽器走
  useEffect(() => {
    const onChange = () =>
      setFocusedId(
        (document.fullscreenElement as HTMLElement | null)?.dataset.videoId ??
          null,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleSound = useCallback(
    (videoId: string) =>
      setUnmuted((prev) => {
        const next = new Set(prev);
        if (!next.delete(videoId)) next.add(videoId);
        return next;
      }),
    [],
  );
  const markUnavailable = useCallback(
    (videoId: string) => setUnavailable((prev) => new Set(prev).add(videoId)),
    [],
  );
  const focus = useCallback((tile: HTMLElement) => {
    void tile.requestFullscreen?.();
  }, []);
  // 退出單格全螢幕；整面牆原本就在全螢幕時會回到整面牆
  const exitFocus = useCallback(() => {
    void document.exitFullscreen?.();
  }, []);

  const playable = videos.filter((v) => !unavailable.has(v.videoId));
  const shown = playable.slice(0, grid * grid);

  return (
    <>
      <Stack
        direction={"row"}
        alignItems={"center"}
        spacing={2}
        sx={{ mb: 1.5 }}
      >
        <Typography variant={"h5"} fontWeight={800}>
          {title}
        </Typography>
        <Stack
          direction={"row"}
          alignItems={"center"}
          spacing={2}
          sx={{ ml: "auto" }}
        >
          <Typography variant={"body2"} color={"text.secondary"} noWrap>
            <Box component={"span"} sx={{ color: "error.main" }}>
              ●
            </Box>{" "}
            {countLabel} {playable.length}
            {playable.length > shown.length &&
              `・顯示 ${shown.length}／${playable.length}`}
          </Typography>
          <Button
            variant={"outlined"}
            size={"small"}
            startIcon={<FullscreenIcon />}
            onClick={() => void wallRef.current?.requestFullscreen?.()}
            sx={{ whiteSpace: "nowrap" }}
          >
            全螢幕
          </Button>
        </Stack>
      </Stack>
      <Box
        ref={wallRef}
        style={style}
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid}, 1fr)`,
          gridTemplateRows: `repeat(${grid}, 1fr)`,
          gap: "2px",
          bgcolor: "#000",
        }}
      >
        {shown.map((video) => (
          <WallTile
            key={video.videoId}
            video={video}
            muted={!unmuted.has(video.videoId)}
            paused={
              !KEEP_OTHERS_PLAYING_ON_FOCUS &&
              focusedId !== null &&
              focusedId !== video.videoId
            }
            focused={focusedId === video.videoId}
            now={now}
            onToggleSound={toggleSound}
            onFocus={focus}
            onExitFocus={exitFocus}
            onUnavailable={markUnavailable}
          />
        ))}
        {/* 空格放在影片後面、用索引當 key：新影片插在前面時不會搬動既有的播放器 */}
        {Array.from({ length: grid * grid - shown.length }, (_, i) => (
          <Box key={`empty-${i}`} sx={{ bgcolor: "#0b0b0b" }} />
        ))}
      </Box>
    </>
  );
}

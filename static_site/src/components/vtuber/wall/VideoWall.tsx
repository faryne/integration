import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import RestoreIcon from "@mui/icons-material/Restore";
import { useCallback, useEffect, useRef, useState } from "react";

import { useNow } from "@/components/vtuber/useNow.ts";
import {
  useWallLayout,
  WALL_GRID,
  WALL_PAGE_SIZE,
} from "@/components/vtuber/wall/wallGrid.ts";
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
 * 電視牆：只吃影片清單，不管資料從哪來。固定 3×3，超過 9 部用鍵盤左右鍵（或標題列箭頭）換頁，
 * 換頁時上一頁的播放器整個卸載，同時最多 9 個；聲音／暫停／移除跟著影片走，換頁回來還在。
 * 全部預設靜音；每格可各自切換聲音、暫停、移除（標題列可還原）；點一格用 Fullscreen API 原地放大（不搬動 iframe，不會斷流）。
 */
export function VideoWall({ title, countLabel, videos }: VideoWallProps) {
  const wallRef = useRef<HTMLDivElement>(null);
  const style = useWallLayout(wallRef);
  const [page, setPage] = useState(0);
  const [unmuted, setUnmuted] = useState<Set<string>>(new Set());
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  // 使用者暫停／移除的格子：只存在這次瀏覽，重新整理就重置
  const [userPaused, setUserPaused] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
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
    (videoId: string) => setUnmuted((prev) => toggled(prev, videoId)),
    [],
  );
  const togglePause = useCallback(
    (videoId: string) => setUserPaused((prev) => toggled(prev, videoId)),
    [],
  );
  const remove = useCallback(
    (videoId: string) => setRemoved((prev) => new Set(prev).add(videoId)),
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

  const playable = videos.filter(
    (v) => !unavailable.has(v.videoId) && !removed.has(v.videoId),
  );
  // 已經結束的直播不算在「已移除」的數量裡
  const removedCount = videos.filter((v) => removed.has(v.videoId)).length;
  // 直播結束、移除後頁數變少時，停在最後一頁
  const pageCount = Math.max(1, Math.ceil(playable.length / WALL_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const shown = playable.slice(
    current * WALL_PAGE_SIZE,
    (current + 1) * WALL_PAGE_SIZE,
  );
  const goPage = useCallback(
    (delta: number) =>
      setPage((p) => Math.max(0, Math.min(pageCount - 1, p + delta))),
    [pageCount],
  );

  // 鍵盤左右鍵換頁（整面全螢幕時也能用）；單格全螢幕時不換頁，不然正在看的那格會被卸載；輸入框裡不攔截
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focusedId || (e.key !== "ArrowLeft" && e.key !== "ArrowRight"))
        return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      goPage(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId, goPage]);

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
          </Typography>
          {pageCount > 1 && (
            <Stack direction={"row"} alignItems={"center"}>
              <IconButton
                size={"small"}
                aria-label={"上一頁"}
                disabled={current === 0}
                onClick={() => goPage(-1)}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography
                variant={"body2"}
                sx={{ minWidth: 44, textAlign: "center" }}
              >
                {current + 1} / {pageCount}
              </Typography>
              <IconButton
                size={"small"}
                aria-label={"下一頁"}
                disabled={current === pageCount - 1}
                onClick={() => goPage(1)}
              >
                <ChevronRightIcon />
              </IconButton>
            </Stack>
          )}
          {removedCount > 0 && (
            <Button
              size={"small"}
              startIcon={<RestoreIcon />}
              onClick={() => setRemoved(new Set())}
              sx={{ whiteSpace: "nowrap" }}
            >
              還原已移除（{removedCount}）
            </Button>
          )}
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
          gridTemplateColumns: `repeat(${WALL_GRID}, 1fr)`,
          gridTemplateRows: `repeat(${WALL_GRID}, 1fr)`,
          gap: "2px",
          bgcolor: "#000",
        }}
      >
        {shown.map((video) => (
          <WallTile
            key={video.videoId}
            video={video}
            muted={!unmuted.has(video.videoId)}
            userPaused={userPaused.has(video.videoId)}
            paused={
              userPaused.has(video.videoId) ||
              (!KEEP_OTHERS_PLAYING_ON_FOCUS &&
                focusedId !== null &&
                focusedId !== video.videoId)
            }
            focused={focusedId === video.videoId}
            now={now}
            onToggleSound={toggleSound}
            onTogglePause={togglePause}
            onRemove={remove}
            onFocus={focus}
            onExitFocus={exitFocus}
            onUnavailable={markUnavailable}
          />
        ))}
        {/* 空格放在影片後面、用索引當 key：新影片插在前面時不會搬動既有的播放器 */}
        {Array.from({ length: WALL_PAGE_SIZE - shown.length }, (_, i) => (
          <Box key={`empty-${i}`} sx={{ bgcolor: "#0b0b0b" }} />
        ))}
      </Box>
    </>
  );
}

// 集合裡有就拿掉、沒有就加入（聲音、暫停的切換共用）
function toggled(set: Set<string>, id: string) {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

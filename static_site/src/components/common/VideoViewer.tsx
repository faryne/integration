import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface VideoViewerSource {
  description?: string;
  duration?: number;
  ext?: string;
  mime?: string;
  thumb?: string;
  thumbnail?: string;
  url: string;
}

interface VideoEmbed {
  provider: string;
  url: string;
}

interface VideoEmbedProvider {
  name: string;
  toEmbedUrl: (url: URL) => string;
}

export function isVideoMedia(media?: VideoViewerSource) {
  if (!media) {
    return false;
  }
  if (getVideoEmbed(media.url)) {
    return true;
  }
  const mime = media.mime?.toLowerCase() ?? "";
  const ext = media.ext?.toLowerCase() ?? "";
  const urlPath = getUrlPath(media.url);
  return (
    mime.startsWith("video/") ||
    ["webm", "mp4", "mov", "m4v"].includes(ext) ||
    /\.(webm|mp4|mov|m4v)$/.test(urlPath)
  );
}

function getUrlPath(url: string) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0] ?? "";
  }
}

function getTwitchParent() {
  if (typeof window !== "undefined" && window.location.hostname) {
    return window.location.hostname;
  }
  return "beta.faryne.dev";
}

const videoEmbedProviders: VideoEmbedProvider[] = [
  {
    name: "youtube",
    toEmbedUrl: (url) => {
      if (url.hostname === "youtu.be") {
        const id = url.pathname.replace(/^\//, "");
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
      }
      if (
        url.hostname.endsWith("youtube.com") ||
        url.hostname.endsWith("youtube-nocookie.com")
      ) {
        const id = url.searchParams.get("v");
        if (id) {
          return `https://www.youtube-nocookie.com/embed/${id}`;
        }
        const shorts = url.pathname.match(/^\/shorts\/([^/]+)/)?.[1];
        if (shorts) {
          return `https://www.youtube-nocookie.com/embed/${shorts}`;
        }
        const embed = url.pathname.match(/^\/embed\/([^/]+)/)?.[1];
        if (embed) {
          return `https://www.youtube-nocookie.com/embed/${embed}`;
        }
      }
      return "";
    },
  },
  {
    name: "vimeo",
    toEmbedUrl: (url) => {
      if (!url.hostname.endsWith("vimeo.com")) {
        return "";
      }
      const id = url.pathname.match(/^\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : "";
    },
  },
  {
    name: "twitch",
    toEmbedUrl: (url) => {
      if (!url.hostname.endsWith("twitch.tv")) {
        return "";
      }
      const videoId = url.pathname.match(/^\/videos\/(\d+)/)?.[1];
      const channel = url.pathname.match(/^\/([^/]+)$/)?.[1];
      const parent = encodeURIComponent(getTwitchParent());
      if (videoId) {
        return `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&parent=${parent}`;
      }
      if (channel) {
        return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}`;
      }
      return "";
    },
  },
  {
    name: "niconico",
    toEmbedUrl: (url) => {
      if (
        !url.hostname.endsWith("nicovideo.jp") &&
        !url.hostname.endsWith("nico.ms")
      ) {
        return "";
      }
      const id =
        url.pathname.match(/^\/watch\/([^/]+)/)?.[1] ||
        url.pathname.match(/^\/([^/]+)/)?.[1];
      return id ? `https://embed.nicovideo.jp/watch/${id}` : "";
    },
  },
];

function getVideoEmbed(rawUrl: string): VideoEmbed | null {
  try {
    const parsed = new URL(rawUrl);
    for (const provider of videoEmbedProviders) {
      const embedUrl = provider.toEmbedUrl(parsed);
      if (embedUrl) {
        return {
          provider: provider.name,
          url: embedUrl,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function VideoViewer({
  children,
  title,
  videos,
}: {
  children?: ReactNode;
  title: string;
  videos: VideoViewerSource[];
}) {
  const [childrenVisible, setChildrenVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoWidth, setVideoWidth] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentVideo = videos.find(isVideoMedia) ?? videos[0];
  const currentDescription = currentVideo?.description?.trim();
  const embed = useMemo(
    () => (currentVideo ? getVideoEmbed(currentVideo.url) : null),
    [currentVideo],
  );
  const isEmbedded = Boolean(embed);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(currentVideo?.duration ?? 0);
    setIsLoaded(isEmbedded);
    setIsPlaying(false);
    setVideoWidth(null);
  }, [currentVideo, isEmbedded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbedded) {
      return;
    }

    const updateWidth = () => {
      const rect = video.getBoundingClientRect();
      setVideoWidth(rect.width > 0 ? rect.width : null);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(video);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [currentVideo, isEmbedded, isLoaded]);

  const play = async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    await video.play();
    setIsPlaying(true);
  };

  const stop = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.pause();
    video.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const pause = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.pause();
    setIsPlaying(false);
  };

  if (!currentVideo) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        minWidth: 0,
        overflow: "hidden",
        p: { xs: 1.5, md: 2 },
      }}
    >
      <Stack spacing={1.5}>
        <Box
          sx={{
            borderRadius: 1.5,
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#0f172a",
              borderRadius: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              justifyContent: "center",
              minHeight: isEmbedded ? 0 : "min(76vh, 860px)",
              p: isEmbedded ? 0 : { xs: 1, md: 2 },
              position: "relative",
              width: "100%",
            }}
          >
            {!isLoaded && (
              <Stack
                alignItems="center"
                spacing={1.5}
                sx={{
                  color: "#e5e7eb",
                  position: "absolute",
                  textAlign: "center",
                }}
              >
                <CircularProgress color="inherit" size={28} thickness={4} />
                <Typography fontWeight={800} variant="body2">
                  影片載入中
                </Typography>
              </Stack>
            )}
            <Stack
              spacing={1}
              sx={{
                alignItems: "stretch",
                maxWidth: "100%",
                width: isEmbedded ? "min(100%, 1120px)" : "fit-content",
              }}
            >
              {isEmbedded ? (
                <Box
                  component="iframe"
                  src={embed?.url ?? ""}
                  title={`${title} (${embed?.provider ?? "embed"})`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  sx={{
                    aspectRatio: "16 / 9",
                    border: 0,
                    borderRadius: 1,
                    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.28)",
                    display: "block",
                    maxHeight: "min(72vh, 820px)",
                    maxWidth: "100%",
                    width: "100%",
                  }}
                />
              ) : (
                <Box
                  component="video"
                  ref={videoRef}
                  aria-label={title}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  poster={
                    currentVideo.thumbnail || currentVideo.thumb || undefined
                  }
                  onCanPlay={() => setIsLoaded(true)}
                  onLoadedMetadata={(event) =>
                    setDuration(event.currentTarget.duration)
                  }
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(event) =>
                    setCurrentTime(event.currentTarget.currentTime)
                  }
                  onError={() => setIsLoaded(true)}
                  sx={{
                    borderRadius: 1,
                    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.28)",
                    display: "block",
                    maxHeight: "min(72vh, 820px)",
                    maxWidth: "100%",
                    objectFit: "contain",
                    opacity: isLoaded ? 1 : 0,
                    transition: "opacity 180ms ease",
                    width: "auto",
                  }}
                >
                  <source
                    src={currentVideo.url}
                    type={currentVideo.mime || "video/webm"}
                  />
                </Box>
              )}
              {(!isEmbedded || children) && (
                <Stack
                  alignItems={{ xs: "stretch", sm: "center" }}
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{
                    bgcolor: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 1,
                    boxSizing: "border-box",
                    color: "#e5e7eb",
                    px: { xs: 1.25, md: 1.5 },
                    py: 1,
                    width: videoWidth ? `${videoWidth}px` : "100%",
                  }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {!isEmbedded && (
                      <>
                        <Tooltip title="播放">
                          <span>
                            <IconButton
                              aria-label="播放"
                              disabled={isPlaying}
                              onClick={play}
                              sx={{
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                "&:hover": { bgcolor: "primary.dark" },
                              }}
                            >
                              <PlayArrowIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="暫停">
                          <span>
                            <IconButton
                              aria-label="暫停"
                              disabled={!isPlaying}
                              onClick={pause}
                              sx={{
                                border: "1px solid rgba(248,250,252,0.42)",
                                color: "#f8fafc",
                              }}
                            >
                              <PauseIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="停止">
                          <span>
                            <IconButton
                              aria-label="停止"
                              disabled={!isPlaying && currentTime === 0}
                              onClick={stop}
                              sx={{
                                border: "1px solid rgba(248,250,252,0.42)",
                                color: "#f8fafc",
                              }}
                            >
                              <StopIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                    {children && (
                      <Tooltip
                        title={
                          childrenVisible
                            ? "收合影片資訊"
                            : "點擊展開影片資訊與相關內容"
                        }
                      >
                        <Button
                          onClick={() =>
                            setChildrenVisible((visible) => !visible)
                          }
                          startIcon={
                            childrenVisible ? (
                              <VisibilityOffOutlinedIcon fontSize="small" />
                            ) : (
                              <InfoOutlinedIcon fontSize="small" />
                            )
                          }
                          sx={
                            childrenVisible
                              ? {
                                  color: "#f8fafc",
                                  borderColor: "rgba(248,250,252,0.42)",
                                }
                              : {
                                  bgcolor: "rgba(245, 158, 11, 0.16)",
                                  borderColor: "#f59e0b",
                                  color: "#fbbf24",
                                  fontWeight: 900,
                                  "&:hover": {
                                    bgcolor: "rgba(245, 158, 11, 0.24)",
                                    borderColor: "#fbbf24",
                                  },
                                }
                          }
                          variant="outlined"
                        >
                          {childrenVisible ? "隱藏資訊" : "顯示資訊"}
                        </Button>
                      </Tooltip>
                    )}
                  </Stack>
                  {!isEmbedded && (
                    <Typography
                      color="inherit"
                      fontWeight={800}
                      textAlign={{ xs: "left", sm: "right" }}
                      variant="body2"
                    >
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>

          {children && (
            <Box
              sx={{
                bottom: { lg: 16 },
                display: {
                  xs: childrenVisible ? "block" : "none",
                  lg: "block",
                },
                left: { lg: 16 },
                mt: { xs: 1, lg: 0 },
                maxWidth: { xs: "100%", lg: "65%" },
                opacity: childrenVisible ? 1 : 0,
                pointerEvents: childrenVisible ? "auto" : "none",
                position: { xs: "static", lg: "absolute" },
                transform: childrenVisible
                  ? "translateY(0)"
                  : "translateY(8px)",
                transition:
                  "opacity 180ms ease, transform 180ms ease, visibility 180ms ease",
                visibility: childrenVisible ? "visible" : "hidden",
                zIndex: 2,
              }}
            >
              {children}
            </Box>
          )}
        </Box>

        {currentDescription && (
          <Typography
            color="text.primary"
            sx={{
              bgcolor: "rgba(15, 23, 42, 0.04)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
              whiteSpace: "pre-wrap",
            }}
            variant="body2"
          >
            {currentDescription}
          </Typography>
        )}

        <Typography color="text.secondary" textAlign="center" variant="body2">
          {isEmbedded
            ? "嵌入式影片使用來源平台播放器。"
            : "影片會自動循環播放，也可以使用下方控制列操作。"}
        </Typography>
      </Stack>
    </Paper>
  );
}

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import type { ReactNode, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

export interface ImageViewerPhoto {
  description?: string;
  ext?: string;
  mime?: string;
  thumb?: string;
  thumbnail?: string;
  url: string;
}

const isVideoPhoto = (photo?: ImageViewerPhoto) => {
  if (!photo) {
    return false;
  }
  const mime = photo.mime?.toLowerCase() ?? "";
  const ext = photo.ext?.toLowerCase() ?? "";
  const urlPath = (() => {
    try {
      return new URL(photo.url).pathname.toLowerCase();
    } catch {
      return photo.url.toLowerCase().split("?")[0] ?? "";
    }
  })();
  return (
    mime.startsWith("video/") ||
    ["webm", "mp4", "mov"].includes(ext) ||
    /\.(webm|mp4|mov)$/.test(urlPath)
  );
};

export function ImageViewer({
  children,
  initialIndex = 0,
  photos,
  title,
}: {
  children?: ReactNode;
  initialIndex?: number;
  photos: ImageViewerPhoto[];
  title: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [childrenVisible, setChildrenVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const isCarousel = photos.length > 1;
  const currentPhoto = photos[currentIndex];
  const currentIsVideo = isVideoPhoto(currentPhoto);
  const currentDescription = currentPhoto?.description?.trim();
  const thumbnails = photos.map(
    (photo) => photo.thumbnail || photo.thumb || "",
  );
  const hasThumbnails = thumbnails.some(Boolean);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < photos.length - 1;
  const allImagesLoaded = photos.length > 0 && loadedCount >= photos.length;

  const goTo = (nextIndex: number) => {
    const normalized = Math.min(Math.max(nextIndex, 0), photos.length - 1);
    if (normalized === currentIndex) {
      return;
    }
    setCurrentIndex(normalized);
    setExpanded(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!isCarousel || !allImagesLoaded || expanded) {
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    suppressClickRef.current = false;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !isCarousel || !allImagesLoaded || expanded) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

    if (!isHorizontalSwipe) {
      return;
    }

    suppressClickRef.current = true;
    if (deltaX > 0 && canGoPrev) {
      goTo(currentIndex - 1);
    }
    if (deltaX < 0 && canGoNext) {
      goTo(currentIndex + 1);
    }
  };

  const handleImageClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded((prev) => !prev);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadedCount(0);
    thumbnailRefs.current = thumbnailRefs.current.slice(0, photos.length);
    setCurrentIndex(
      photos.length > 0
        ? Math.min(Math.max(initialIndex, 0), photos.length - 1)
        : 0,
    );
    setExpanded(false);

    const urls = photos.map((photo) => photo.url).filter(Boolean);
    if (urls.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    photos.forEach((photo) => {
      const url = photo.url;
      if (!url) {
        return;
      }
      const markLoaded = () => {
        if (!cancelled) {
          setLoadedCount((count) => count + 1);
        }
      };
      if (isVideoPhoto(photo)) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = markLoaded;
        video.onerror = markLoaded;
        video.src = url;
        return;
      }
      const image = new Image();
      image.onload = markLoaded;
      image.onerror = markLoaded;
      image.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [initialIndex, photos]);

  useEffect(() => {
    if (!allImagesLoaded || !hasThumbnails) {
      return;
    }

    thumbnailRefs.current[currentIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [allImagesLoaded, currentIndex, hasThumbnails]);

  useEffect(() => {
    if (!isCarousel || !allImagesLoaded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (canGoPrev) {
          goTo(currentIndex - 1);
        }
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (canGoNext) {
          goTo(currentIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    allImagesLoaded,
    canGoNext,
    canGoPrev,
    currentIndex,
    isCarousel,
    photos.length,
  ]);

  if (!currentPhoto) {
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
        {isCarousel && allImagesLoaded && (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Chip
              label={`第 ${currentIndex + 1} / ${photos.length} 張`}
              variant="outlined"
            />
            <Button
              disabled={!canGoPrev}
              onClick={() => goTo(currentIndex - 1)}
              startIcon={<ArrowBackIosNewIcon fontSize="small" />}
              variant="outlined"
            >
              上一張
            </Button>
            <Button
              disabled={!canGoNext}
              onClick={() => goTo(currentIndex + 1)}
              endIcon={<ArrowForwardIosIcon fontSize="small" />}
              variant="outlined"
            >
              下一張
            </Button>
          </Stack>
        )}

        {!allImagesLoaded ? (
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#0f172a",
              borderRadius: 1.5,
              display: "flex",
              justifyContent: "center",
              minHeight: "min(76vh, 860px)",
              width: "100%",
            }}
          >
            <Stack
              alignItems="center"
              spacing={1.5}
              sx={{ color: "#e5e7eb", textAlign: "center" }}
            >
              <CircularProgress color="inherit" size={28} thickness={4} />
              <Typography fontWeight={800} variant="body2">
                圖片載入中（{loadedCount} / {photos.length}）
              </Typography>
              <Typography color="rgba(229,231,235,0.72)" variant="caption">
                會在全部圖片載入完成後顯示作品。
              </Typography>
            </Stack>
          </Box>
        ) : (
          <Box
            sx={{
              alignItems: "stretch",
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                md: hasThumbnails ? "92px minmax(0, 1fr)" : "1fr",
              },
              width: "100%",
            }}
          >
            {hasThumbnails && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "row", md: "column" },
                  gap: 1,
                  maxHeight: { md: expanded ? "none" : "min(76vh, 860px)" },
                  order: { xs: 2, md: 1 },
                  overflow: "auto",
                  pb: { xs: 0.5, md: 0 },
                  pr: { xs: 0, md: 0.5 },
                }}
              >
                {photos.map((_, index) => {
                  const thumbnail = thumbnails[index];
                  if (!thumbnail) {
                    return null;
                  }
                  const selected = index === currentIndex;
                  return (
                    <Box
                      key={`${thumbnail}-${index}`}
                      component="button"
                      type="button"
                      ref={(element: HTMLButtonElement | null) => {
                        thumbnailRefs.current[index] = element;
                      }}
                      aria-label={`切換到第 ${index + 1} 張圖片`}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => goTo(index)}
                      sx={{
                        appearance: "none",
                        bgcolor: selected ? "#f8fafc" : "#111827",
                        border: "2px solid",
                        borderColor: selected ? "#f59e0b" : "transparent",
                        borderRadius: 1.25,
                        boxShadow: selected
                          ? "0 0 0 3px rgba(245, 158, 11, 0.24)"
                          : "none",
                        cursor: "pointer",
                        flex: "0 0 auto",
                        height: { xs: 58, md: 78 },
                        opacity: selected ? 1 : 0.58,
                        overflow: "hidden",
                        p: 0.25,
                        transition:
                          "border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease, transform 160ms ease",
                        width: { xs: 78, md: "100%" },
                        "&:hover": {
                          opacity: 1,
                          transform: "translateY(-1px)",
                        },
                        "&:focus-visible": {
                          outline: "3px solid rgba(245, 158, 11, 0.46)",
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={thumbnail}
                        alt={`${title} thumbnail ${index + 1}`}
                        loading="lazy"
                        sx={{
                          borderRadius: 0.75,
                          display: "block",
                          height: "100%",
                          objectFit: "cover",
                          width: "100%",
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
            <Box
              sx={{
                borderRadius: 1.5,
                cursor: expanded ? "zoom-out" : "zoom-in",
                order: { xs: 1, md: 2 },
                position: "relative",
                width: "100%",
              }}
            >
              <Box
                component="div"
                role="button"
                tabIndex={0}
                onClick={handleImageClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleImageClick();
                  }
                }}
                sx={{
                  alignItems: expanded ? "flex-start" : "center",
                  appearance: "none",
                  bgcolor: "#0f172a",
                  border: 0,
                  borderRadius: 1.5,
                  cursor: expanded ? "zoom-out" : "zoom-in",
                  display: "flex",
                  justifyContent: "center",
                  minHeight: expanded ? "auto" : "min(76vh, 860px)",
                  overflow: "auto",
                  p: expanded ? 0 : { xs: 1, md: 2 },
                  touchAction: expanded ? "auto" : "pan-y",
                  width: "100%",
                }}
              >
                {currentIsVideo ? (
                  <Box
                    component="video"
                    aria-label={`${title} ${currentIndex + 1}`}
                    autoPlay
                    loop
                    muted
                    playsInline
                    sx={{
                      borderRadius: expanded ? 0 : 1,
                      boxShadow: expanded
                        ? "none"
                        : "0 18px 50px rgba(0, 0, 0, 0.28)",
                      display: "block",
                      height: expanded ? "auto" : "auto",
                      maxHeight: expanded ? "none" : "min(72vh, 820px)",
                      maxWidth: expanded ? "none" : "100%",
                      objectFit: "contain",
                      width: expanded ? "auto" : "auto",
                    }}
                  >
                    <source
                      src={currentPhoto.url}
                      type={currentPhoto.mime || "video/webm"}
                    />
                  </Box>
                ) : (
                  <Box
                    component="img"
                    src={currentPhoto.url}
                    alt={`${title} ${currentIndex + 1}`}
                    sx={{
                      borderRadius: expanded ? 0 : 1,
                      boxShadow: expanded
                        ? "none"
                        : "0 18px 50px rgba(0, 0, 0, 0.28)",
                      display: "block",
                      height: expanded ? "auto" : "auto",
                      maxHeight: expanded ? "none" : "min(72vh, 820px)",
                      maxWidth: expanded ? "none" : "100%",
                      objectFit: "contain",
                      width: expanded ? "auto" : "auto",
                    }}
                  />
                )}
              </Box>
              {children && (
                <>
                  {!childrenVisible && (
                    <Button
                      color="inherit"
                      onClick={(event) => {
                        event.stopPropagation();
                        setChildrenVisible(true);
                      }}
                      onTouchStart={(event) => event.stopPropagation()}
                      size="small"
                      startIcon={<InfoOutlinedIcon fontSize="small" />}
                      sx={{
                        backdropFilter: "blur(12px)",
                        bgcolor: "rgba(15, 23, 42, 0.72)",
                        border: "1px solid rgba(255, 255, 255, 0.18)",
                        borderRadius: 999,
                        boxShadow:
                          "0 12px 30px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
                        bottom: { xs: 10, md: 16 },
                        color: "#f8fafc",
                        fontWeight: 900,
                        justifyContent: "center",
                        letterSpacing: 0.2,
                        left: { xs: 10, md: 16 },
                        minWidth: { xs: 168, md: 210 },
                        position: "absolute",
                        px: 2,
                        width: { xs: 210, sm: 240, md: 260 },
                        zIndex: 3,
                        "&:hover": {
                          bgcolor: "rgba(15, 23, 42, 0.86)",
                          boxShadow:
                            "0 16px 40px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                          transform: "translateY(-1px)",
                        },
                      }}
                      variant="contained"
                    >
                      顯示資訊
                    </Button>
                  )}
                  <Box
                    sx={{
                      bottom: { xs: 10, md: 16 },
                      left: { xs: 10, md: 16 },
                      maxWidth: { xs: "calc(100% - 20px)", md: "65%" },
                      opacity: childrenVisible ? 1 : 0,
                      pointerEvents: childrenVisible ? "auto" : "none",
                      position: "absolute",
                      transform: childrenVisible
                        ? "translateY(0)"
                        : "translateY(8px)",
                      transition:
                        "opacity 180ms ease, transform 180ms ease, visibility 180ms ease",
                      visibility: childrenVisible ? "visible" : "hidden",
                      zIndex: 2,
                    }}
                  >
                    <Button
                      color="inherit"
                      onClick={(event) => {
                        event.stopPropagation();
                        setChildrenVisible(false);
                      }}
                      onTouchStart={(event) => event.stopPropagation()}
                      size="small"
                      startIcon={<VisibilityOffOutlinedIcon fontSize="small" />}
                      sx={{
                        backdropFilter: "blur(12px)",
                        bgcolor: "rgba(15, 23, 42, 0.72)",
                        border: "1px solid rgba(255, 255, 255, 0.18)",
                        borderRadius: 999,
                        boxShadow:
                          "0 10px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
                        color: "#f8fafc",
                        fontWeight: 900,
                        letterSpacing: 0.2,
                        minWidth: 132,
                        position: "absolute",
                        px: 1.75,
                        left: { xs: 14, md: 20 },
                        top: 0,
                        transform: "translateY(-50%)",
                        zIndex: 1,
                        "&:hover": {
                          bgcolor: "rgba(15, 23, 42, 0.86)",
                          boxShadow:
                            "0 14px 32px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                          transform: "translateY(calc(-50% - 1px))",
                        },
                      }}
                      variant="contained"
                    >
                      隱藏資訊
                    </Button>
                    {children}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}

        {allImagesLoaded && currentDescription && (
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

        {allImagesLoaded && (
          <Typography color="text.secondary" textAlign="center" variant="body2">
            點擊圖片可{expanded ? "縮回視窗內" : "放大檢視"}。
            {isCarousel && " 可使用鍵盤左右鍵或左右滑動切換圖片。"}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

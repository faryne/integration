import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CloseIcon from "@mui/icons-material/Close";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import type { ReactNode, TouchEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePuzzleDialog } from "@/components/common/ImagePuzzleDialog.tsx";

export interface ImageViewerPhoto {
  description?: string;
  ext?: string;
  metadataLines?: string[];
  mime?: string;
  thumb?: string;
  thumbnail?: string;
  url: string;
}

interface SlideTransition {
  direction: 1 | -1;
  index: number;
  photo: ImageViewerPhoto;
}

const SLIDE_DURATION = 280;

function slideTransform(
  entered: boolean,
  isOutgoing: boolean,
  direction: 1 | -1,
) {
  if (isOutgoing) {
    return entered ? `translateX(${direction * -100}%)` : "translateX(0)";
  }
  return entered ? "translateX(0)" : `translateX(${direction * 100}%)`;
}

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
  const [childrenVisible, setChildrenVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [naturalHeights, setNaturalHeights] = useState<number[]>([]);
  const [naturalWidths, setNaturalWidths] = useState<number[]>([]);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [slideEntered, setSlideEntered] = useState(false);
  const [slideTransition, setSlideTransition] = useState<SlideTransition | null>(
    null,
  );
  const [viewportSize, setViewportSize] = useState({ height: 0, width: 0 });
  const imageStageRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const isCarousel = photos.length > 1;
  const currentPhoto = photos[currentIndex];
  const currentDescription = currentPhoto?.description?.trim();
  const currentMetadataLines =
    currentPhoto?.metadataLines?.filter(Boolean) ?? [];
  const currentNaturalWidth = naturalWidths[currentIndex] ?? 0;
  const currentNaturalHeight = naturalHeights[currentIndex] ?? 0;
  const thumbnails = photos.map(
    (photo) => photo.thumbnail || photo.thumb || "",
  );
  const hasThumbnails = thumbnails.some(Boolean);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < photos.length - 1;
  const allImagesLoaded = photos.length > 0 && loadedCount >= photos.length;
  const canPlayPuzzle =
    expanded &&
    currentNaturalWidth > 0 &&
    currentNaturalHeight > 0 &&
    viewportSize.width > 0 &&
    viewportSize.height > 0 &&
    currentNaturalWidth <= viewportSize.width &&
    currentNaturalHeight <= viewportSize.height;

  const goTo = (nextIndex: number) => {
    const normalized = Math.min(Math.max(nextIndex, 0), photos.length - 1);
    if (normalized === currentIndex) {
      return;
    }
    const direction: 1 | -1 = normalized > currentIndex ? 1 : -1;
    setSlideTransition({ direction, index: currentIndex, photo: currentPhoto });
    setCurrentIndex(normalized);
    setExpanded(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!isCarousel || !allImagesLoaded || expanded || dialogOpen) {
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    suppressClickRef.current = false;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !isCarousel || !allImagesLoaded || expanded || dialogOpen) {
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
    if (expanded) {
      setExpanded(false);
      return;
    }

    const stage = imageStageRef.current;
    const stageWidth = stage?.clientWidth ?? 0;
    if (
      currentNaturalWidth > 0 &&
      stageWidth > 0 &&
      currentNaturalWidth >= stageWidth
    ) {
      setDialogOpen(true);
      return;
    }

    setExpanded(true);
  };

  useEffect(() => {
    let cancelled = false;
    setLoadedCount(0);
    setDialogOpen(false);
    setPuzzleOpen(false);
    thumbnailRefs.current = thumbnailRefs.current.slice(0, photos.length);
    setNaturalHeights(Array.from({ length: photos.length }, () => 0));
    setNaturalWidths(Array.from({ length: photos.length }, () => 0));
    setCurrentIndex(
      photos.length > 0
        ? Math.min(Math.max(initialIndex, 0), photos.length - 1)
        : 0,
    );
    setExpanded(false);
    setSlideTransition(null);
    setSlideEntered(false);

    const urls = photos.map((photo) => photo.url).filter(Boolean);
    if (urls.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    photos.forEach((photo, index) => {
      const url = photo.url;
      if (!url) {
        return;
      }
      const markLoaded = () => {
        if (!cancelled) {
          setNaturalWidths((widths) => {
            const nextWidths = [...widths];
            nextWidths[index] = image.naturalWidth;
            return nextWidths;
          });
          setNaturalHeights((heights) => {
            const nextHeights = [...heights];
            nextHeights[index] = image.naturalHeight;
            return nextHeights;
          });
          setLoadedCount((count) => count + 1);
        }
      };
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
    const updateViewportSize = () => {
      setViewportSize({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
      window.removeEventListener("orientationchange", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    if (!slideTransition) {
      return;
    }

    const raf = requestAnimationFrame(() => setSlideEntered(true));
    const timeout = window.setTimeout(() => {
      setSlideTransition(null);
      setSlideEntered(false);
    }, SLIDE_DURATION);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [slideTransition]);

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
      if (dialogOpen && event.key === "Escape") {
        setDialogOpen(false);
        return;
      }
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
    dialogOpen,
    isCarousel,
    photos.length,
  ]);

  useLayoutEffect(() => {
    if (!expanded || !allImagesLoaded) {
      return;
    }

    const stage = imageStageRef.current;
    if (!stage) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      stage.scrollLeft = Math.max(
        0,
        (stage.scrollWidth - stage.clientWidth) / 2,
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [allImagesLoaded, currentIndex, expanded]);

  if (!currentPhoto) {
    return null;
  }

  return (
    <>
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
                  xs: "minmax(0, 1fr)",
                  md: hasThumbnails ? "92px minmax(0, 1fr)" : "minmax(0, 1fr)",
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
                  ref={imageStageRef}
                  sx={{
                    appearance: "none",
                    bgcolor: "#0f172a",
                    border: 0,
                    borderRadius: 1.5,
                    cursor: expanded ? "zoom-out" : "zoom-in",
                    display: "block",
                    minHeight: "min(76vh, 860px)",
                    overflow: "auto",
                    p: expanded ? 0 : { xs: 1, md: 2 },
                    touchAction: expanded ? "auto" : "pan-y",
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      alignItems: "center",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      justifyContent: "center",
                      minHeight: "min(76vh, 860px)",
                      minWidth: expanded ? "max-content" : 0,
                      mx: expanded ? "auto" : 0,
                      width: expanded ? "max-content" : "100%",
                    }}
                  >
                    <Box
                      sx={{
                        height: slideTransition ? "min(72vh, 820px)" : "auto",
                        position: "relative",
                        width: slideTransition ? "100%" : "auto",
                      }}
                    >
                      {slideTransition && (
                        <Box
                          component="img"
                          src={slideTransition.photo.url}
                          alt={`${title} ${slideTransition.index + 1}`}
                          sx={{
                            borderRadius: 1,
                            boxShadow: "0 18px 50px rgba(0, 0, 0, 0.28)",
                            height: "100%",
                            inset: 0,
                            objectFit: "contain",
                            pointerEvents: "none",
                            position: "absolute",
                            transform: slideTransform(
                              slideEntered,
                              true,
                              slideTransition.direction,
                            ),
                            transition: `transform ${SLIDE_DURATION}ms ease`,
                            width: "100%",
                          }}
                        />
                      )}
                      <Box
                        key={currentPhoto.url}
                        component="img"
                        src={currentPhoto.url}
                        alt={`${title} ${currentIndex + 1}`}
                        sx={{
                          borderRadius: expanded ? 0 : 1,
                          boxShadow: expanded
                            ? "none"
                            : "0 18px 50px rgba(0, 0, 0, 0.28)",
                          display: "block",
                          height: expanded
                            ? "auto"
                            : slideTransition
                              ? "100%"
                              : "auto",
                          inset: slideTransition ? 0 : undefined,
                          maxHeight: expanded ? "none" : "min(72vh, 820px)",
                          maxWidth: expanded ? "none" : "100%",
                          objectFit: "contain",
                          position: slideTransition ? "absolute" : "static",
                          transform: slideTransition
                            ? slideTransform(
                                slideEntered,
                                false,
                                slideTransition.direction,
                              )
                            : "none",
                          transition: slideTransition
                            ? `transform ${SLIDE_DURATION}ms ease`
                            : "none",
                          width: expanded
                            ? "auto"
                            : slideTransition
                              ? "100%"
                              : "auto",
                        }}
                      />
                    </Box>

                    {(isCarousel ||
                      children ||
                      currentMetadataLines.length > 0) && (
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
                          mt: 1,
                          mx: "auto",
                          px: { xs: 1.25, md: 1.5 },
                          py: 1,
                          width: {
                            xs: "min(100%, 360px)",
                            sm: "min(100%, 460px)",
                            md: "min(100%, 520px)",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ minWidth: 0 }}
                        >
                          {isCarousel && (
                            <>
                              <Tooltip title="上一張">
                                <span>
                                  <IconButton
                                    aria-label="上一張"
                                    disabled={!canGoPrev}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      goTo(currentIndex - 1);
                                    }}
                                    sx={{
                                      border:
                                        "1px solid rgba(248,250,252,0.42)",
                                      color: "#f8fafc",
                                    }}
                                  >
                                    <ArrowBackIosNewIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="下一張">
                                <span>
                                  <IconButton
                                    aria-label="下一張"
                                    disabled={!canGoNext}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      goTo(currentIndex + 1);
                                    }}
                                    sx={{
                                      border:
                                        "1px solid rgba(248,250,252,0.42)",
                                      color: "#f8fafc",
                                    }}
                                  >
                                    <ArrowForwardIosIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                        <Stack
                          alignItems={{ xs: "stretch", sm: "center" }}
                          direction={{ xs: "column", sm: "row" }}
                          flexShrink={0}
                          spacing={1}
                        >
                          {currentMetadataLines.length > 0 && (
                            <Stack
                              spacing={0.25}
                              sx={{
                                color: "rgba(248,250,252,0.78)",
                                minWidth: { sm: 128 },
                                textAlign: { xs: "left", sm: "right" },
                              }}
                            >
                              {currentMetadataLines.map((line) => (
                                <Typography
                                  key={line}
                                  color="inherit"
                                  fontWeight={800}
                                  lineHeight={1.25}
                                  variant="caption"
                                >
                                  {line}
                                </Typography>
                              ))}
                            </Stack>
                          )}
                          {children && (
                            <Tooltip
                              title={
                                childrenVisible
                                  ? "收合作品資訊"
                                  : "點擊展開作品資訊與相關內容"
                              }
                            >
                              <Button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setChildrenVisible((visible) => !visible);
                                }}
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
                          {isCarousel && (
                            <Chip
                              label={`第 ${currentIndex + 1} / ${photos.length} 張`}
                              sx={{
                                bgcolor: "rgba(255,255,255,0.1)",
                                color: "#f8fafc",
                                fontWeight: 800,
                              }}
                            />
                          )}
                        </Stack>
                      </Stack>
                    )}
                  </Box>
                </Box>
                {canPlayPuzzle && (
                  <Tooltip title="用目前圖片玩拼圖">
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        setPuzzleOpen(true);
                      }}
                      startIcon={<ExtensionOutlinedIcon fontSize="small" />}
                      sx={{
                        backdropFilter: "blur(10px)",
                        bgcolor: "rgba(251, 191, 36, 0.18)",
                        border: "1px solid rgba(251, 191, 36, 0.72)",
                        borderRadius: 999,
                        bottom: { xs: 12, md: 18 },
                        boxShadow: "0 14px 36px rgba(0, 0, 0, 0.28)",
                        color: "#fbbf24",
                        fontWeight: 900,
                        position: "absolute",
                        right: { xs: 12, md: 18 },
                        zIndex: 4,
                        "&:hover": {
                          bgcolor: "rgba(251, 191, 36, 0.28)",
                          borderColor: "#fbbf24",
                        },
                      }}
                      variant="outlined"
                    >
                      玩拼圖
                    </Button>
                  </Tooltip>
                )}
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
            <Typography
              color="text.secondary"
              textAlign="center"
              variant="body2"
            >
              點擊圖片可{expanded ? "縮回視窗內" : "放大檢視"}。
              {isCarousel && " 可使用鍵盤左右鍵或左右滑動切換圖片。"}
            </Typography>
          )}
        </Stack>
      </Paper>
      <Dialog
        fullScreen
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: "#020617",
            color: "#f8fafc",
          },
        }}
      >
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "rgba(2, 6, 23, 0.92)",
            borderBottom: "1px solid rgba(248,250,252,0.12)",
            display: "flex",
            gap: 1,
            justifyContent: "space-between",
            px: { xs: 1, md: 2 },
            py: 1,
          }}
        >
          <Stack direction="row" spacing={1}>
            {isCarousel && (
              <>
                <Tooltip title="上一張">
                  <span>
                    <IconButton
                      aria-label="上一張"
                      disabled={!canGoPrev}
                      onClick={() => goTo(currentIndex - 1)}
                      sx={{ color: "#f8fafc" }}
                    >
                      <ArrowBackIosNewIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="下一張">
                  <span>
                    <IconButton
                      aria-label="下一張"
                      disabled={!canGoNext}
                      onClick={() => goTo(currentIndex + 1)}
                      sx={{ color: "#f8fafc" }}
                    >
                      <ArrowForwardIosIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
          </Stack>
          <Typography
            fontWeight={900}
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textAlign: "center",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            variant="body2"
          >
            {isCarousel
              ? `${title}（第 ${currentIndex + 1} / ${photos.length} 張）`
              : title}
          </Typography>
          <Tooltip title="關閉">
            <IconButton
              aria-label="關閉全圖"
              onClick={() => setDialogOpen(false)}
              sx={{ color: "#f8fafc" }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          sx={{
            height: "calc(100vh - 57px)",
            overflow: "auto",
            width: "100vw",
          }}
        >
          <Box
            component="img"
            src={currentPhoto.url}
            alt={`${title} ${currentIndex + 1}`}
            sx={{
              display: "block",
              height: "auto",
              maxWidth: "none",
              width: "auto",
            }}
          />
        </Box>
      </Dialog>
      <ImagePuzzleDialog
        imageUrl={currentPhoto.url}
        onClose={() => setPuzzleOpen(false)}
        open={puzzleOpen}
        title={
          isCarousel
            ? `${title}（第 ${currentIndex + 1} / ${photos.length} 張）`
            : title
        }
      />
    </>
  );
}

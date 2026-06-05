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
import type { TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";

export function ArtworkImageViewer({
  photos,
  title,
}: {
  photos: NekomaidArtwork["photos"];
  title: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const isCarousel = photos.length > 1;
  const currentPhoto = photos[currentIndex];
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

  const handleTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    if (!isCarousel || !allImagesLoaded || expanded) {
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    suppressClickRef.current = false;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
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
    setCurrentIndex(0);
    setExpanded(false);

    const urls = photos.map((photo) => photo.url).filter(Boolean);
    if (urls.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    urls.forEach((url) => {
      const image = new Image();
      const markLoaded = () => {
        if (!cancelled) {
          setLoadedCount((count) => count + 1);
        }
      };
      image.onload = markLoaded;
      image.onerror = markLoaded;
      image.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [photos]);

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
            component="button"
            type="button"
            onClick={handleImageClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
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
          </Box>
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

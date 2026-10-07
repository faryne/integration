import type { ReaderImagePage } from "@/pages/storyteller/readerModel.ts";
import { Box, Paper, Typography } from "@mui/material";
import { useRef, useState } from "react";

// 比照 YouTube 播放器的進度列：滑鼠移到軌道上的某個位置會浮出該頁的縮圖預覽，點擊
// 直接跳到那一頁。頁面是離散的（不是連續時間），滑鼠位置會吸附到最近的一頁，不會有
// 「中間值」。頁數只有 1 頁時沒有可跳的地方，直接不渲染。
export function ImagePageScrubber({
  pages,
  currentIndex,
  onJump,
}: {
  pages: ReaderImagePage[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const total = pages.length;

  function indexFromPointer(clientX: number): number {
    const track = trackRef.current;
    if (!track || total <= 1) {
      return 0;
    }
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(Math.max(Math.round(ratio * (total - 1)), 0), total - 1);
  }

  if (total <= 1) {
    return null;
  }

  const hoverPage = hoverIndex !== null ? pages[hoverIndex] : null;
  const percentOf = (index: number) => (index / (total - 1)) * 100;

  return (
    <Box sx={{ position: "relative" }}>
      {hoverPage && hoverIndex !== null && (
        <Box
          sx={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: `${percentOf(hoverIndex)}%`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              width: 84,
              overflow: "hidden",
              borderRadius: 1,
              borderWidth: 2,
              borderColor: "primary.main",
              boxShadow: 3,
            }}
          >
            <Box
              component="img"
              src={hoverPage.imageUrl}
              alt={`第 ${hoverIndex + 1} 頁預覽`}
              sx={{
                width: "100%",
                height: 112,
                objectFit: "cover",
                display: "block",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "center",
                py: 0.25,
                bgcolor: "background.paper",
              }}
            >
              第 {hoverIndex + 1} 頁
            </Typography>
          </Paper>
        </Box>
      )}
      <Box
        ref={trackRef}
        onMouseMove={(event) => setHoverIndex(indexFromPointer(event.clientX))}
        onMouseLeave={() => setHoverIndex(null)}
        onClick={(event) => onJump(indexFromPointer(event.clientX))}
        sx={{
          position: "relative",
          height: 20,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: 6,
            borderRadius: 3,
            bgcolor: "action.disabledBackground",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${percentOf(currentIndex)}%`,
              bgcolor: "primary.main",
              transition: "width .12s",
            }}
          />
        </Box>
        {pages.map((page, index) => (
          <Box
            key={page.id}
            sx={{
              position: "absolute",
              left: `${percentOf(index)}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: index === currentIndex ? 12 : 8,
              height: index === currentIndex ? 12 : 8,
              borderRadius: "50%",
              bgcolor:
                index === currentIndex
                  ? "primary.main"
                  : index < currentIndex
                    ? "primary.light"
                    : "background.paper",
              border: "2px solid",
              borderColor: index === currentIndex ? "primary.main" : "divider",
              pointerEvents: "none",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

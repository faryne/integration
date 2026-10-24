import { Box, IconButton, Stack, useMediaQuery } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useCallback, useEffect, useRef, useState } from "react";

import { LiveCard } from "@/components/vtuber/LiveCard.tsx";
import type { VtuberLive } from "@/types/vtubers.ts";

const AUTOPLAY_MS = 5000;
const GAP = 12;

interface LiveCarouselProps {
  lives: VtuberLive[];
  onPlay: (live: VtuberLive) => void;
}

// 一格＝一張卡片寬＋間距
const stepOf = (el: HTMLElement) =>
  (el.firstElementChild?.getBoundingClientRect().width ?? 0) + GAP;

// Fisher–Yates 洗牌
function shuffled<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 總覽「直播中」：一排卡片的輪播（桌機一次 4 張、平板 3 張、手機橫向滑動），高度不隨場次增加。
 * 順序亂數，只在第一次排；之後資料每分鐘更新時保留原本順序，新開播的洗牌後接在後面、已結束的拿掉，卡片才不會一直跳。
 * 每 5 秒往下一格，捲到底回到第一張；滑鼠移上去、觸碰、點箭頭後暫停；系統偏好減少動態效果時不自動播放。
 */
export function LiveCarousel({ lives, onPlay }: LiveCarouselProps) {
  const [order, setOrder] = useState(() =>
    shuffled(lives.map((l) => l.video_id)),
  );
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  // 位置：目前在第幾格、總共可以停幾格（圓點用）
  const [position, setPosition] = useState({ page: 0, pages: 1 });
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const ids = lives.map((l) => l.video_id);
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = shuffled(ids.filter((id) => !prev.includes(id)));
      return [...kept, ...added];
    });
  }, [lives]);

  const updatePosition = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const step = stepOf(el);
    setPosition({
      page: Math.round(el.scrollLeft / step),
      pages: Math.max(
        1,
        Math.round((el.scrollWidth - el.clientWidth) / step) + 1,
      ),
    });
  }, []);
  useEffect(updatePosition, [order, updatePosition]);
  // 視窗縮放會改變卡片寬度與可停的格數，但不會觸發捲動事件
  useEffect(() => {
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [updatePosition]);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      const el = scroller.current;
      if (!el || paused.current || el.scrollWidth - el.clientWidth <= 2) return;
      const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
      el.scrollTo({
        left: end ? 0 : el.scrollLeft + stepOf(el),
        behavior: "smooth",
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    paused.current = true;
    el?.scrollBy({ left: direction * stepOf(el), behavior: "smooth" });
  };
  const { page, pages } = position;

  const byId = new Map(lives.map((l) => [l.video_id, l]));
  const items = order
    .map((id) => byId.get(id))
    .filter((l): l is VtuberLive => Boolean(l));
  const arrowSx = {
    position: "absolute",
    top: "calc(50% - 46px)",
    zIndex: 1,
    display: { xs: "none", sm: "inline-flex" },
    bgcolor: "background.paper",
    boxShadow: 2,
    "&:hover": { bgcolor: "background.paper" },
  } as const;

  return (
    <Box sx={{ position: "relative" }}>
      {page > 0 && (
        <IconButton
          aria-label={"上一個"}
          onClick={() => scrollBy(-1)}
          sx={{ ...arrowSx, left: -16 }}
        >
          <ChevronLeftIcon />
        </IconButton>
      )}
      <Stack
        ref={scroller}
        direction={"row"}
        onScroll={updatePosition}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onTouchStart={() => (paused.current = true)}
        sx={{
          gap: `${GAP}px`,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          "& > *": {
            flex: {
              xs: "0 0 78%",
              sm: `0 0 calc((100% - ${GAP * 2}px) / 3)`,
              md: `0 0 calc((100% - ${GAP * 3}px) / 4)`,
            },
            scrollSnapAlign: "start",
            // 卡片外框要算進寬度，不然 4 張加總會超出容器幾 px，多出不必要的捲動
            boxSizing: "border-box",
            minWidth: 0,
          },
        }}
      >
        {items.map((live) => (
          <LiveCard key={live.video_id} live={live} onPlay={onPlay} />
        ))}
      </Stack>
      {page < pages - 1 && (
        <IconButton
          aria-label={"下一個"}
          onClick={() => scrollBy(1)}
          sx={{ ...arrowSx, right: -16 }}
        >
          <ChevronRightIcon />
        </IconButton>
      )}
      {pages > 1 && (
        <Stack
          direction={"row"}
          spacing={0.75}
          justifyContent={"center"}
          sx={{ mt: 1.25 }}
        >
          {Array.from({ length: pages }, (_, i) => (
            <Box
              key={i}
              sx={{
                height: 6,
                width: i === page ? 18 : 6,
                borderRadius: 3,
                bgcolor: i === page ? "error.main" : "divider",
                transition: "width .2s",
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

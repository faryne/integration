import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

// 格數：最少 5×5、最多 9×9；YouTube 播放器至少 200×200，16:9 的格子寬至少 356
const MIN_GRID = 5;
const MAX_GRID = 9;
const MIN_TILE_HEIGHT = 200;
const MIN_TILE_WIDTH = Math.ceil((MIN_TILE_HEIGHT * 16) / 9);
// 視窗太矮時電視牆仍保留的最小高度
const MIN_WALL_HEIGHT = 400;

export function gridSize(width: number, height: number) {
  const fit = Math.floor(
    Math.min(width / MIN_TILE_WIDTH, height / MIN_TILE_HEIGHT),
  );
  return Math.min(MAX_GRID, Math.max(MIN_GRID, fit));
}

/**
 * 電視牆的尺寸：寬度撐滿整個視窗（跳出頁面 1280 的內容寬度），高度填滿首屏剩下的空間。
 * 回傳要套在牆上的 style 與依實際大小算出的格數；全螢幕時瀏覽器會把牆放到整個螢幕，格數跟著重算。
 */
export function useWallLayout(ref: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ marginLeft: 0, width: 0, height: 0 });
  const [grid, setGrid] = useState(MIN_GRID);

  // 依視窗算出撐滿寬度需要的位移與高度。原本的起點＝目前位置扣掉已套用的 margin；
  // 監看 <html> 的大小而不是 window resize，垂直捲軸出現／消失（可用寬度改變）時也會重算
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const naturalLeft =
        rect.left - parseFloat(getComputedStyle(el).marginLeft);
      setBox({
        marginLeft: -naturalLeft,
        width: document.documentElement.clientWidth,
        height: Math.max(
          MIN_WALL_HEIGHT,
          window.innerHeight - (rect.top + window.scrollY),
        ),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  // 格數看牆實際的大小（全螢幕時就是整個螢幕）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setGrid(gridSize(entry.contentRect.width, entry.contentRect.height)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return { style: box, grid };
}

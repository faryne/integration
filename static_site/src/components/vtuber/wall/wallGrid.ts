import { useLayoutEffect, useState, type RefObject } from "react";

// 固定 3×3；超過 9 部就分頁，同時只建立一頁（9 個）播放器
export const WALL_GRID = 3;
export const WALL_PAGE_SIZE = WALL_GRID * WALL_GRID;
// 視窗太矮時電視牆仍保留的最小高度
const MIN_WALL_HEIGHT = 400;

/**
 * 電視牆的尺寸：寬度撐滿整個視窗（跳出頁面 1280 的內容寬度），高度填滿首屏剩下的空間。
 * 回傳要套在牆上的 style；全螢幕時瀏覽器會把牆放到整個螢幕，這組 style 會被蓋掉。
 */
export function useWallLayout(ref: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ marginLeft: 0, width: 0, height: 0 });

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

  return box;
}

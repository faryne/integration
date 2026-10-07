import { useEffect, useRef, useState } from "react";
import {
  READING_PROGRESS_STEP,
  type ReaderProgress,
} from "./readingRecordStore.ts";

// 閱讀頁本文容器的捲動計算，跟 Reader.tsx 算閱讀進度的公式一致（分母不含底部留白），
// 進度百分比與捲動位置才能互相換算。
export function readerScrollableRange(node: HTMLElement) {
  const bodyTop = node.getBoundingClientRect().top + window.scrollY;
  const bottomSpacerHeight =
    node.querySelector<HTMLElement>("[data-reader-bottom-spacer]")
      ?.offsetHeight ?? 0;
  return {
    bodyTop,
    scrollable: node.offsetHeight - bottomSpacerHeight - window.innerHeight,
  };
}

// 換篇後要等標題 smooth scroll 跑完一段、內文排版穩定，才跳到上次的位置
const RESUME_SCROLL_DELAY_MS = 400;

// 打開一篇「讀到一半」的內容時跳回上次的位置：文字故事捲到對應百分比、圖像作品翻到對應頁。
// 每一篇只在打開時做一次；網址帶 hash（書籤、標題跳轉）或在看歷史版本時，讀者有明確的
// 目的地，不能被拉走。讀完的篇章重新打開則從頭開始。
// 回傳 resumedProgress（跳回時的百分比）給呼叫端顯示提示，dismiss 用來關掉提示。
export function useReadingResume({
  itemId,
  isImage,
  ready,
  progress,
  skip,
  bodyNode,
  totalPages,
  setPageIndex,
}: {
  itemId?: string;
  isImage: boolean;
  ready: boolean;
  progress?: ReaderProgress;
  skip: boolean;
  bodyNode: HTMLElement | null;
  totalPages: number;
  setPageIndex: (index: number) => void;
}) {
  const resumedItemRef = useRef<string | undefined>(undefined);
  // 計時器放 ref、只在換篇或卸載時清掉：progress 每次 render 都是新物件，若交給主 effect 的
  // cleanup 清，下一次 render 就會把還沒觸發的捲動取消掉
  const timerRef = useRef<number | null>(null);
  const [resumedProgress, setResumedProgress] = useState<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [itemId],
  );

  useEffect(() => {
    // 圖像作品要等頁面清單載入才知道要翻到第幾頁；文字故事要等本文容器掛上才能換算捲動位置
    if (
      !ready ||
      !itemId ||
      resumedItemRef.current === itemId ||
      (isImage ? totalPages === 0 : !bodyNode)
    ) {
      return;
    }
    resumedItemRef.current = itemId;
    setResumedProgress(null);
    if (
      skip ||
      !progress ||
      progress.completed ||
      progress.progress < READING_PROGRESS_STEP
    ) {
      return;
    }
    const target = progress.progress;
    if (isImage) {
      setPageIndex(
        Math.min(
          Math.max(Math.round((target / 100) * totalPages) - 1, 0),
          totalPages - 1,
        ),
      );
      setResumedProgress(target);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const node = bodyNode;
      if (!node) {
        return;
      }
      const { bodyTop, scrollable } = readerScrollableRange(node);
      if (scrollable <= 0) {
        return;
      }
      window.scrollTo({
        top: bodyTop + (scrollable * target) / 100,
        behavior: "instant",
      });
      setResumedProgress(target);
    }, RESUME_SCROLL_DELAY_MS);
  }, [
    ready,
    itemId,
    isImage,
    totalPages,
    skip,
    progress,
    bodyNode,
    setPageIndex,
  ]);

  return { resumedProgress, dismiss: () => setResumedProgress(null) };
}

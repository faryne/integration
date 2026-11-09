import { useMemo, useState } from "react";

import {
  useJoyuMarks,
  useSetMark,
  type JoyuVideoMark,
  type MarkStatus,
} from "@/apis/av/joyu_marks.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { joyuFirebaseReady } from "@/lib/joyuFirebase.ts";

import { useJoyuAuth } from "../auth/JoyuAuthContext.ts";

/** 自己的片單整理成 番號（小寫）→ 狀態；卡片小標與影片頁按鈕共用（react-query 共用同一份快取） */
export function useMyMarks() {
  const { user } = useJoyuAuth();
  const marks = useJoyuMarks(user?.uid);
  return useMemo(
    () => new Map((marks.data ?? []).map((m) => [m.no, m])),
    [marks.data],
  );
}

/**
 * 影片頁片單按鈕的邏輯：目前狀態、切換想看／看過、評分（沒登入先建立匿名帳號，不跳登入）。
 * 規則：想看／看過互斥，按已選的那顆會取消；評分會自動變成看過，點同一顆星取消評分
 */
export function useVideoMark(videoNo: string) {
  const no = videoNo.toLowerCase();
  const { ensureUser } = useJoyuAuth();
  const mark: JoyuVideoMark | undefined = useMyMarks().get(no);
  const setMark = useSetMark();
  const [error, setError] = useState("");

  const save = async (next: Omit<JoyuVideoMark, "no"> | null) => {
    try {
      const u = await ensureUser();
      await setMark.mutateAsync({ uid: u.uid, no, mark: next });
    } catch (err) {
      setError(apiErrorMessage(err, "片單更新失敗，請稍後再試"));
    }
  };
  const toggleStatus = (status: MarkStatus) =>
    save(
      mark?.status === status
        ? null
        : { status, rating: status === "watched" ? (mark?.rating ?? 0) : 0 },
    );
  const rate = (rating: number) =>
    save({
      status: "watched",
      rating: mark?.status === "watched" && mark.rating === rating ? 0 : rating,
    });

  return {
    ready: joyuFirebaseReady,
    mark,
    toggleStatus,
    rate,
    error,
    clearError: () => setError(""),
  };
}

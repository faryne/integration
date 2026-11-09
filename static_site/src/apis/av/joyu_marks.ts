import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import { joyuApi } from "@/apis/av/joyu_me.ts";
import type { Video } from "@/types/av.ts";

// joyu.fyi 片單（想看／看過＋評分）：個人清單走 /joyu/me/marks（要帶 token），影片統計是公開 API

export type MarkStatus = "want" | "watched";

export interface JoyuVideoMark {
  no: string;
  status: MarkStatus;
  // 1～5，0 表示沒評分
  rating: number;
}

export interface MarkSummary {
  want: number;
  watched: number;
  rating_count: number;
  // 評分人數少於 3 人時是 null（不顯示平均）
  rating_avg: number | null;
}

export interface MarkedVideo {
  mark: JoyuVideoMark;
  // 影片已經不在索引裡時是 null
  video: Video | null;
}

export interface MarkedVideosParams {
  status: MarkStatus;
  rating?: "5" | "4" | "le3" | "none";
  sort?: "date";
  page: number;
}

// 片單相關的 query key 都以 "joyu/marks" 開頭：登出、刪帳號時一次清掉
export const MARKS_KEY_PREFIX = "joyu/marks";
const marksKey = (uid?: string) => [MARKS_KEY_PREFIX, uid];
const markedVideosKey = (uid?: string) => [MARKS_KEY_PREFIX, "videos", uid];
const summaryKey = (no: string) => ["av/video/marks-summary", no];

// 剛改過片單的影片：統計 API 有 CDN 快取，之後查這幾部時多帶 _fresh 繞過，才看得到自己剛按的那一票
const freshNos = new Set<string>();

/** 全部片單（輕量）：影片頁按鈕狀態、全站卡片小標用；沒登入時不查 */
export function useJoyuMarks(uid?: string) {
  return useQuery({
    queryKey: marksKey(uid),
    queryFn: () => joyuApi<JoyuVideoMark[]>("GET", "/marks"),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });
}

/** 影片的全站統計（公開） */
export function useMarkSummary(no: string) {
  return useQuery({
    queryKey: summaryKey(no),
    queryFn: async () => {
      const res = await axios.get<CommonResponse<MarkSummary>>(
        `${import.meta.env.VITE_API_BASE}/opendata/av/video/${encodeURIComponent(no)}/marks-summary`,
        { params: freshNos.has(no) ? { _fresh: Date.now() } : undefined },
      );
      return res.data.data;
    },
    enabled: !!no,
  });
}

/** 我的片單頁 */
export function useMarkedVideos(
  uid: string | undefined,
  params: MarkedVideosParams,
) {
  return useQuery({
    queryKey: [...markedVideosKey(uid), params],
    queryFn: () =>
      joyuApi<Pagination<MarkedVideo[]>>("GET", "/marks/videos", { params }),
    enabled: !!uid,
  });
}

/**
 * 設定或移除片單（mark 為 null 是移除）：先樂觀更新清單，失敗退回；完成後重抓統計與片單頁。
 * uid 跟著每次呼叫傳進來：第一次按的時候才建立匿名帳號
 */
export function useSetMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      no,
      mark,
    }: {
      uid: string;
      no: string;
      mark: Omit<JoyuVideoMark, "no"> | null;
    }) =>
      mark
        ? joyuApi<null>("PUT", `/marks/${encodeURIComponent(no)}`, {
            data: mark,
          })
        : joyuApi<null>("DELETE", `/marks/${encodeURIComponent(no)}`),
    onMutate: async ({ uid, no, mark }) => {
      const key = marksKey(uid);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<JoyuVideoMark[]>(key);
      const rest = (prev ?? []).filter((m) => m.no !== no);
      qc.setQueryData(key, mark ? [{ no, ...mark }, ...rest] : rest);
      return { prev };
    },
    // 清單本來就沒讀到過（prev 是 undefined）時 setQueryData 不會動作，要整個拿掉讓它重讀
    onError: (_e, { uid }, ctx) =>
      ctx?.prev === undefined
        ? qc.removeQueries({ queryKey: marksKey(uid) })
        : qc.setQueryData(marksKey(uid), ctx.prev),
    onSettled: (_d, _e, { uid, no }) => {
      freshNos.add(no);
      void qc.invalidateQueries({ queryKey: marksKey(uid) });
      void qc.invalidateQueries({ queryKey: markedVideosKey(uid) });
      void qc.invalidateQueries({ queryKey: summaryKey(no) });
    },
  });
}

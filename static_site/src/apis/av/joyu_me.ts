import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios, { type Method } from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import { getJoyuAuth } from "@/lib/joyuFirebase.ts";
import type { Actress, Video } from "@/types/av.ts";

// joyu.fyi 登入後的個人 API（後端 controller/joyu）：每次帶 joyu-firebase 的 ID token，沒有 session。
// token 一小時過期，Firebase SDK 會自動換新；後端還是回 401 時強制更新一次再重試

export type FollowKind =
  "actress" | "maker" | "label" | "series" | "director" | "tag" | "search";

export interface JoyuFollow {
  kind: FollowKind;
  value: string;
}

export interface JoyuFollowItem extends JoyuFollow {
  label: string;
  actress?: Actress;
  missing?: boolean;
  search_query: string;
}

export interface JoyuFeedSection extends JoyuFollowItem {
  count: number;
  last: string;
  videos: Video[];
  // 同一組條件的預約作品（未來 30 天，配信日近的在前）
  upcoming_count: number;
  upcoming: Video[];
}

export interface JoyuFeed {
  days: number;
  since: string;
  sections: JoyuFeedSection[];
  quiet: JoyuFollowItem[];
}

export async function joyuApi<T>(
  method: Method,
  path: string,
  options: {
    data?: unknown;
    params?: unknown;
    token?: string;
    // 額外的 header（例：匿名帳號留言時的 X-Recaptcha-Token）
    headers?: Record<string, string>;
  } = {},
) {
  const call = async (forceRefresh: boolean) => {
    const user = getJoyuAuth()?.auth.currentUser;
    if (!user) throw new Error("not signed in");
    const token = await user.getIdToken(forceRefresh);
    const res = await axios.request<CommonResponse<T>>({
      method,
      url: `${import.meta.env.VITE_API_BASE}/joyu/me${path}`,
      data: options.data,
      params: options.params,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return res.data.data;
  };
  try {
    return await call(false);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 401) return call(true);
    throw e;
  }
}

const followsKey = (uid?: string) => ["joyu/follows", uid];
const feedKey = (uid?: string) => ["joyu/feed", uid];

/** 全部追蹤（畫愛心狀態用）；沒登入時不查 */
export function useJoyuFollows(uid?: string) {
  return useQuery({
    queryKey: followsKey(uid),
    queryFn: () => joyuApi<JoyuFollow[]>("GET", "/follows"),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });
}

/** 我的追蹤頁：最近 days 天各追蹤的新片 */
export function useJoyuFeed(uid: string | undefined, days: number) {
  return useQuery({
    queryKey: [...feedKey(uid), days],
    queryFn: () => joyuApi<JoyuFeed>("GET", "/feed", { params: { days } }),
    enabled: !!uid,
  });
}

/**
 * 追蹤／取消追蹤：先樂觀更新愛心狀態，失敗退回；成功後讓我的追蹤頁重抓。
 * uid 跟著每次呼叫傳進來：第一次按愛心時才建立匿名帳號，元件當下拿到的 uid 可能還是空的
 */
export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      follow,
      on,
    }: {
      uid: string;
      follow: JoyuFollow;
      on: boolean;
    }) => joyuApi<null>(on ? "PUT" : "DELETE", "/follows", { data: follow }),
    onMutate: async ({ uid, follow, on }) => {
      const key = followsKey(uid);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<JoyuFollow[]>(key);
      const rest = (prev ?? []).filter(
        (f) => !(f.kind === follow.kind && f.value === follow.value),
      );
      qc.setQueryData(key, on ? [follow, ...rest] : rest);
      return { prev };
    },
    // 還原成送出前的清單；清單本來就沒讀到過（prev 是 undefined）時 setQueryData 不會動作，要整個拿掉讓它重讀
    onError: (_e, { uid }, ctx) =>
      ctx?.prev === undefined
        ? qc.removeQueries({ queryKey: followsKey(uid) })
        : qc.setQueryData(followsKey(uid), ctx.prev),
    onSettled: (_d, _e, { uid }) => {
      void qc.invalidateQueries({ queryKey: followsKey(uid) });
      void qc.invalidateQueries({ queryKey: feedKey(uid) });
    },
  });
}

/** 匿名帳號升級時遇到既有 Google 帳號：用目前（Google）帳號的 token 呼叫，把匿名帳號的追蹤搬過來 */
export const mergeAnonymousFollows = (anonymousToken: string) =>
  joyuApi<null>("POST", "/merge", {
    data: { anonymous_token: anonymousToken },
  });

/** 刪除帳號的資料（全部追蹤）；Firebase 帳號由呼叫端接著刪 */
export const deleteJoyuAccountData = () => joyuApi<null>("DELETE", "");

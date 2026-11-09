import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import type { CommonResponse } from "@/apis/interfaces.ts";
import { joyuApi } from "@/apis/av/joyu_me.ts";
import { recaptchaHeaders } from "@/lib/recaptcha.ts";

// joyu.fyi 討論版：列表、回覆是公開 API（no-store）；送出、檢舉、暱稱走 /joyu/me（要帶 token）

export interface CommentAuthor {
  name: string;
  // anonymous／google／deleted（已刪除的帳號）
  kind?: "anonymous" | "google" | "deleted";
}

export interface JoyuComment {
  id: number;
  author: CommentAuthor;
  // 被管理員刪除時是空字串
  body: string;
  deleted: boolean;
  reply_to?: CommentAuthor;
  created_at: string;
  // 只有頂層留言有：回覆總數與最新 3 則（先舊後新）
  reply_count: number;
  replies?: JoyuComment[];
}

export interface JoyuCommentPage {
  // 這個討論版全部留言數（含回覆、不含被刪的）
  count: number;
  total: number;
  page: number;
  per_page: number;
  data: JoyuComment[];
}

export interface JoyuProfile {
  nickname: string;
  display_name: string;
  can_edit: boolean;
}

export type ReportReason = "spam" | "harass" | "privacy" | "other";

const api = import.meta.env.VITE_API_BASE;
const commentsKey = (target: string) => ["joyu/comments", target];
const repliesKey = (id: number) => ["joyu/comments/replies", id];
export const PROFILE_KEY_PREFIX = "joyu/profile";

/** 一頁頂層留言（target：video:番號／actress:domain:aid）；第 1 頁也拿來顯示分頁標題的留言數 */
export function useComments(target: string, page = 1) {
  return useQuery({
    queryKey: [...commentsKey(target), page],
    queryFn: async () => {
      const res = await axios.get<CommonResponse<JoyuCommentPage>>(
        `${api}/opendata/av/comments`,
        { params: { target, page } },
      );
      return res.data.data;
    },
    enabled: !!target,
  });
}

/** 一則頂層留言的全部回覆（點「顯示全部」才查） */
export function useReplies(id: number, enabled: boolean) {
  return useQuery({
    queryKey: repliesKey(id),
    queryFn: async () => {
      const res = await axios.get<CommonResponse<JoyuComment[]>>(
        `${api}/opendata/av/comments/${id}/replies`,
      );
      return res.data.data;
    },
    enabled,
  });
}

/** 送出留言或回覆：匿名帳號帶 reCAPTCHA token；成功後重抓這個討論版與該則的回覆 */
export function usePostComment(target: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      body: string;
      replyTo?: number;
      anonymous: boolean;
    }) =>
      joyuApi<JoyuComment>("POST", "/comments", {
        data: { target, body: v.body, reply_to: v.replyTo ?? 0 },
        headers: v.anonymous ? await recaptchaHeaders("JOYU_COMMENT") : {},
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(target) });
      void qc.invalidateQueries({ queryKey: ["joyu/comments/replies"] });
    },
  });
}

export function useReportComment() {
  return useMutation({
    mutationFn: (v: { id: number; reason: ReportReason }) =>
      joyuApi<null>("POST", `/comments/${v.id}/report`, {
        data: { reason: v.reason },
      }),
  });
}

/** 個人資料（暱稱）；沒登入時不查 */
export function useJoyuProfile(uid?: string) {
  return useQuery({
    queryKey: [PROFILE_KEY_PREFIX, uid],
    queryFn: () => joyuApi<JoyuProfile>("GET", "/profile"),
    enabled: !!uid,
  });
}

export function useSetNickname(uid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) =>
      joyuApi<JoyuProfile>("PUT", "/profile", { data: { nickname } }),
    onSuccess: (p) => {
      qc.setQueryData([PROFILE_KEY_PREFIX, uid], p);
      // 討論版上自己的名字也要跟著換
      void qc.invalidateQueries({ queryKey: ["joyu/comments"] });
    },
  });
}

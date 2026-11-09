import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import { useAdminSession } from "@/apis/av/adminSession.ts";

// joyu 討論版的後台管理 API（/admin/joyu/*）：主站 session、管理者才 enabled

const base = `${import.meta.env.VITE_API_BASE}/admin/joyu`;

export interface JoyuAdminComment {
  id: number;
  target_type: "actress" | "video";
  target_key: string;
  firebase_uid: string;
  author_name: string;
  is_anonymous: boolean;
  body: string;
  parent_id: number;
  ip: string;
  report_count: number;
  is_deleted: boolean;
  created_at: string;
  reasons?: Record<string, number>;
}

export interface JoyuBan {
  id: number;
  ban_type: "uid" | "ip";
  value: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
}

export type JoyuAdminTab = "reported" | "latest";

export function useJoyuAdminComments(tab: JoyuAdminTab, page: number) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: ["joyu-admin/comments", tab, page],
    enabled,
    retry: false,
    queryFn: async () =>
      (
        await axios.get<CommonResponse<Pagination<JoyuAdminComment[]>>>(
          `${base}/comments`,
          { params: { tab, page }, headers },
        )
      ).data.data,
  });
}

export function useJoyuAdminBans(on: boolean) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: ["joyu-admin/bans"],
    enabled: enabled && on,
    retry: false,
    queryFn: async () =>
      (await axios.get<CommonResponse<JoyuBan[]>>(`${base}/bans`, { headers }))
        .data.data,
  });
}

/** 刪除留言、封鎖、解除封鎖：完成後重抓列表與封鎖名單 */
export function useJoyuAdminActions() {
  const { headers } = useAdminSession();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["joyu-admin/comments"] });
    void qc.invalidateQueries({ queryKey: ["joyu-admin/bans"] });
  };
  return {
    deleteComment: useMutation({
      mutationFn: (id: number) =>
        axios.delete(`${base}/comments/${id}`, { headers }),
      onSuccess: refresh,
    }),
    ban: useMutation({
      mutationFn: (v: {
        ban_type: "uid" | "ip";
        value: string;
        days: number;
        reason: string;
      }) => axios.post(`${base}/bans`, v, { headers }),
      onSuccess: refresh,
    }),
    lift: useMutation({
      mutationFn: (id: number) =>
        axios.delete(`${base}/bans/${id}`, { headers }),
      onSuccess: refresh,
    }),
  };
}

import axios from "axios";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerNotification,
  StorytellerNotificationFilter,
  StorytellerNotificationKindDefinition,
  StorytellerNotificationPage,
} from "@/types/storytellerNotification.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

const notificationsQueryKey = ["storyteller", "notifications"];

// 鈴鐺未讀數的輪詢間隔；分頁在背景時 TanStack Query 預設不輪詢，切回來由 refetchOnWindowFocus 補上。
const UNREAD_POLL_INTERVAL_MS = 60 * 1000;

function useNotificationRequest() {
  const { session } = useAuth();
  return {
    userId: session?.user.id,
    enabled: Boolean(session?.encrypt_key),
    headers: session ? sessionHeaders(session.encrypt_key) : {},
  };
}

export function useStorytellerNotificationUnreadCount() {
  const { userId, enabled, headers } = useNotificationRequest();
  return useQuery({
    queryKey: [...notificationsQueryKey, "unread-count", userId],
    enabled,
    refetchInterval: UNREAD_POLL_INTERVAL_MS,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<{ unread_count: number }>
      >(`${apiBase}/storyteller/notifications/unread-count`, { headers });
      return response.data.data.unread_count;
    },
  });
}

// 通知類型註冊表（文字／分類／呈現方式）；整個 session 只抓一次，重新整理頁面才會更新
export function useStorytellerNotificationKinds() {
  const { userId, enabled, headers } = useNotificationRequest();
  return useQuery({
    // 不放在 notificationsQueryKey 底下：標已讀／鎖定後的 invalidate 不需要重抓註冊表
    queryKey: ["storyteller", "notification-kinds", userId],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerNotificationKindDefinition[]>
      >(`${apiBase}/storyteller/notification-kinds`, { headers });
      return response.data.data ?? [];
    },
  });
}

// 通知列表（cursor 分頁）；popover 與通知頁共用，popover 只取第一頁。
export function useStorytellerNotifications(
  filter: StorytellerNotificationFilter = "all",
  enabled = true,
) {
  const request = useNotificationRequest();
  return useInfiniteQuery({
    queryKey: [...notificationsQueryKey, "list", filter, request.userId],
    enabled: request.enabled && enabled,
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<
        CommonResponse<StorytellerNotificationPage>
      >(`${apiBase}/storyteller/notifications`, {
        headers: request.headers,
        params: { filter, cursor: pageParam || undefined },
      });
      return response.data.data;
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor || undefined,
  });
}

// 單則內容：深連結直接打開內容頁時，列表可能還沒載到這一則。
export function useStorytellerNotification(publicId?: string) {
  const request = useNotificationRequest();
  return useQuery({
    queryKey: [...notificationsQueryKey, "detail", publicId, request.userId],
    enabled: request.enabled && Boolean(publicId),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerNotification>>(
        `${apiBase}/storyteller/notifications/${publicId}`,
        { headers: request.headers },
      );
      return response.data.data;
    },
  });
}

type NotificationAction =
  | { type: "read"; publicId: string }
  | { type: "read-all" }
  | { type: "lock"; publicId: string }
  | { type: "unlock"; publicId: string }
  | { type: "delete"; publicId: string }
  // as 只在作品有多個署名身份時需要
  | { type: "follow-back"; publicId: string; as?: string };

// 所有會改變通知狀態的操作共用一支 mutation，成功後一律重抓列表、未讀數與內容。
export function useStorytellerNotificationAction() {
  const { headers } = useNotificationRequest();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: NotificationAction) => {
      const base = `${apiBase}/storyteller/notifications`;
      switch (action.type) {
        case "read":
          return axios.post(`${base}/${action.publicId}/read`, null, {
            headers,
          });
        case "read-all":
          return axios.post(`${base}/read-all`, null, { headers });
        case "lock":
          return axios.post(`${base}/${action.publicId}/lock`, null, {
            headers,
          });
        case "unlock":
          return axios.delete(`${base}/${action.publicId}/lock`, { headers });
        case "delete":
          return axios.delete(`${base}/${action.publicId}`, { headers });
        case "follow-back":
          return axios.post(
            `${base}/${action.publicId}/follow-back`,
            { as: action.as ?? "" },
            { headers },
          );
      }
    },
    onSuccess: (_, action) => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      // 回追會改變作者頁按鈕與「我的追蹤」
      if (action.type === "follow-back") {
        void queryClient.invalidateQueries({
          queryKey: ["storyteller", "author-favorite"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["storyteller", "favorite-authors"],
        });
      }
    },
  });
}

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
  AttachableWork,
  AuthorBlock,
  AuthorPost,
  AuthorPostDetail,
  AuthorPostInput,
  AuthorPostPage,
  CommentInput,
} from "@/types/storytellerTimeline.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 作者動態、留言、封鎖。讀取類是公開 API，有登入時帶 session 讓後端回
// liked_by_me／is_owner／能否留言（沒帶的話作者本人看自己的頁面也會被當成訪客）。

const timelineQueryKey = ["storyteller", "timeline"];
const blocksQueryKey = ["storyteller", "author-blocks"];

function useTimelineRequest() {
  const { session } = useAuth();
  return {
    userId: session?.user.id,
    loggedIn: Boolean(session?.encrypt_key),
    headers: session ? sessionHeaders(session.encrypt_key) : undefined,
  };
}

const pen = (penName: string) => encodeURIComponent(penName);

// 作者頁「動態」分頁：第一頁含置頂那則，之後 cursor 分頁
export function useAuthorPosts(penName?: string) {
  const { userId, headers } = useTimelineRequest();
  return useInfiniteQuery({
    queryKey: [...timelineQueryKey, "list", penName, userId],
    enabled: Boolean(penName),
    retry: false,
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<CommonResponse<AuthorPostPage>>(
        `${apiBase}/storyteller/user/${pen(penName!)}/posts`,
        { headers, params: { cursor: pageParam || undefined } },
      );
      return response.data.data;
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor || undefined,
  });
}

// 貼文單頁＋留言串
export function useAuthorPost(postPublicId?: string) {
  const { userId, headers } = useTimelineRequest();
  return useQuery({
    queryKey: [...timelineQueryKey, "detail", postPublicId, userId],
    enabled: Boolean(postPublicId),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<AuthorPostDetail>>(
        `${apiBase}/storyteller/posts/${postPublicId}`,
        { headers },
      );
      return response.data.data;
    },
  });
}

// 發文框「附上作品」的候選：只有這個身份署名、目前公開的作品
export function useAttachableWorks(penName: string, enabled: boolean) {
  const { userId, loggedIn, headers } = useTimelineRequest();
  return useQuery({
    queryKey: [...timelineQueryKey, "attachable", penName, userId],
    enabled: enabled && loggedIn,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<AttachableWork[]>>(
        `${apiBase}/storyteller/user/${pen(penName)}/attachable-works`,
        { headers },
      );
      return response.data.data ?? [];
    },
  });
}

export type TimelineAction =
  | { type: "create-post"; penName: string; input: AuthorPostInput }
  | { type: "delete-post"; postId: string }
  | { type: "pin"; postId: string; pinned: boolean }
  | { type: "like"; postId: string; liked: boolean }
  | { type: "comment"; postId: string; input: CommentInput }
  | { type: "delete-comment"; commentId: string }
  | { type: "block"; commentId: string };

// 動態相關的寫入共用一支 mutation，成功後重抓時間軸與貼文單頁（封鎖另外重抓封鎖名單）。
export function useTimelineAction() {
  const { headers } = useTimelineRequest();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: TimelineAction) => {
      const base = `${apiBase}/storyteller`;
      switch (action.type) {
        case "create-post":
          return (
            await axios.post<CommonResponse<AuthorPost>>(
              `${base}/user/${pen(action.penName)}/posts`,
              action.input,
              { headers },
            )
          ).data.data;
        case "delete-post":
          return axios.delete(`${base}/posts/${action.postId}`, { headers });
        case "pin":
          return axios({
            method: action.pinned ? "put" : "delete",
            url: `${base}/posts/${action.postId}/pin`,
            headers,
          });
        case "like":
          return axios({
            method: action.liked ? "put" : "delete",
            url: `${base}/posts/${action.postId}/like`,
            headers,
          });
        case "comment":
          return (
            await axios.post<CommonResponse<{ public_id: string }>>(
              `${base}/posts/${action.postId}/comments`,
              action.input,
              { headers },
            )
          ).data.data;
        case "delete-comment":
          return axios.delete(`${base}/comments/${action.commentId}`, {
            headers,
          });
        case "block":
          return axios.post(
            `${base}/comments/${action.commentId}/block`,
            null,
            {
              headers,
            },
          );
      }
    },
    onSuccess: (_, action) => {
      void queryClient.invalidateQueries({ queryKey: timelineQueryKey });
      if (action.type === "block") {
        void queryClient.invalidateQueries({ queryKey: blocksQueryKey });
      }
    },
  });
}

// 工作台封鎖名單；as 是筆名，空字串是本人
export function useAuthorBlocks(as: string) {
  const { userId, loggedIn, headers } = useTimelineRequest();
  return useQuery({
    queryKey: [...blocksQueryKey, as, userId],
    enabled: loggedIn,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<AuthorBlock[]>>(
        `${apiBase}/storyteller/blocks`,
        { headers, params: { as: as || undefined } },
      );
      return response.data.data ?? [];
    },
  });
}

export function useDeleteAuthorBlock() {
  const { headers } = useTimelineRequest();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) =>
      axios.delete(`${apiBase}/storyteller/blocks/${publicId}`, { headers }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blocksQueryKey });
      void queryClient.invalidateQueries({ queryKey: timelineQueryKey });
    },
  });
}

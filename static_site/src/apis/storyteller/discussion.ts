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
  DiscussionFilter,
  DiscussionList,
  DiscussionSort,
  DiscussionThreadDetail,
  DiscussionThreadInput,
} from "@/types/storytellerDiscussion.ts";
import type { CommentInput } from "@/types/storytellerTimeline.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 專案討論版。讀取是公開 API；有登入時帶 session，後端才回得出能不能發言、可用身份與權限。
// 不公開（僅限連結）作品的所有請求都要帶 share（分享 token）。

const discussionQueryKey = ["storyteller", "discussion"];

function useDiscussionRequest() {
  const { session } = useAuth();
  return {
    userId: session?.user.id,
    headers: session ? sessionHeaders(session.encrypt_key) : undefined,
  };
}

export interface DiscussionListParams {
  filter?: DiscussionFilter;
  sort?: DiscussionSort;
  // 閱讀頁 modal：只列錨定這一話／這篇設定的串
  anchorStory?: string;
  anchorLore?: string;
  share?: string;
}

export function useDiscussionThreads(
  projectPublicId: string | undefined,
  params: DiscussionListParams,
  enabled = true,
) {
  const { userId, headers } = useDiscussionRequest();
  return useInfiniteQuery({
    queryKey: [...discussionQueryKey, "list", projectPublicId, params, userId],
    enabled: enabled && Boolean(projectPublicId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<CommonResponse<DiscussionList>>(
        `${apiBase}/storyteller/story/${projectPublicId}/discussions`,
        {
          headers,
          params: {
            filter: params.filter,
            sort: params.sort,
            anchor_story: params.anchorStory,
            anchor_lore: params.anchorLore,
            share: params.share,
            page: pageParam,
          },
        },
      );
      return response.data.data;
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((n, page) => n + page.items.length, 0) < last.total
        ? last.page + 1
        : undefined,
  });
}

// 展開一串時才抓：開頭內文＋整串留言
export function useDiscussionThread(
  threadPublicId: string | undefined,
  share?: string,
) {
  const { userId, headers } = useDiscussionRequest();
  return useQuery({
    queryKey: [...discussionQueryKey, "detail", threadPublicId, share, userId],
    enabled: Boolean(threadPublicId),
    retry: false,
    queryFn: async () => {
      const response = await axios.get<CommonResponse<DiscussionThreadDetail>>(
        `${apiBase}/storyteller/discussions/${threadPublicId}`,
        { headers, params: { share } },
      );
      return response.data.data;
    },
  });
}

export type DiscussionAction =
  | { type: "create"; projectId: string; input: DiscussionThreadInput }
  | { type: "edit"; threadId: string; title: string; body: string }
  | { type: "delete"; threadId: string }
  | { type: "lock"; threadId: string; locked: boolean }
  | { type: "block-starter"; threadId: string }
  | { type: "comment"; threadId: string; input: CommentInput }
  | { type: "edit-comment"; commentId: string; body: string }
  | { type: "delete-comment"; commentId: string }
  | { type: "block-commenter"; commentId: string };

// 討論版的寫入共用一支 mutation；成功後重抓列表與詳情（封鎖也會影響動態與封鎖名單）。
export function useDiscussionAction(share?: string) {
  const { headers } = useDiscussionRequest();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: DiscussionAction) => {
      const base = `${apiBase}/storyteller`;
      const config = { headers, params: { share } };
      switch (action.type) {
        case "create":
          return (
            await axios.post<CommonResponse<{ public_id: string }>>(
              `${base}/story/${action.projectId}/discussions`,
              action.input,
              config,
            )
          ).data.data;
        case "edit":
          return axios.put(
            `${base}/discussions/${action.threadId}`,
            { title: action.title, body: action.body },
            config,
          );
        case "delete":
          return axios.delete(`${base}/discussions/${action.threadId}`, config);
        case "lock":
          return axios({
            method: action.locked ? "put" : "delete",
            url: `${base}/discussions/${action.threadId}/lock`,
            ...config,
          });
        case "block-starter":
          return axios.post(
            `${base}/discussions/${action.threadId}/block`,
            null,
            config,
          );
        case "comment":
          return axios.post(
            `${base}/discussions/${action.threadId}/comments`,
            action.input,
            config,
          );
        case "edit-comment":
          return axios.put(
            `${base}/comments/${action.commentId}`,
            { body: action.body },
            config,
          );
        case "delete-comment":
          return axios.delete(`${base}/comments/${action.commentId}`, config);
        case "block-commenter":
          return axios.post(
            `${base}/comments/${action.commentId}/block`,
            null,
            config,
          );
      }
    },
    onSuccess: (_, action) => {
      void queryClient.invalidateQueries({ queryKey: discussionQueryKey });
      if (
        action.type === "block-starter" ||
        action.type === "block-commenter"
      ) {
        void queryClient.invalidateQueries({
          queryKey: ["storyteller", "author-blocks"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["storyteller", "timeline"],
        });
      }
    },
  });
}

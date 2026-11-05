import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import {
  nekoHttp,
  useNekomaidSession,
} from "@/apis/nekomaid/accountSession.ts";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";
import type {
  NekomaidFavoriteAuthor,
  NekomaidFavoriteKeys,
} from "@/types/nekomaidAccount.ts";

// 我的追蹤（追蹤畫師、收藏作品）；全部要登入
export const NEKOMAID_FAVORITE_PAGE_SIZE = 24;
const favoritesKey = "nekomaid-favorites";

export const authorKey = (site: string, authorId: string | number) =>
  `${site}/${authorId}`;
export const artworkKey = (
  site: string,
  authorId: string | number,
  artworkId: string,
) => `${site}/${authorId}/${artworkId}`;

/** 全部收藏的 key（畫愛心、追蹤按鈕狀態） */
export function useNekomaidFavoriteKeys() {
  const session = useNekomaidSession();
  return useQuery({
    queryKey: [favoritesKey, "keys", session?.user.id],
    enabled: Boolean(session),
    staleTime: 60_000,
    queryFn: async () => {
      const keys = (
        await nekoHttp.get<CommonResponse<NekomaidFavoriteKeys>>(
          "/me/favorites/keys",
        )
      ).data.data;
      return {
        authors: new Set(keys.authors),
        artworks: new Set(keys.artworks),
      };
    },
  });
}

function useFavoriteList<T>(kind: "authors" | "artworks", page: number) {
  const session = useNekomaidSession();
  return useQuery({
    queryKey: [favoritesKey, kind, session?.user.id, page],
    enabled: Boolean(session),
    queryFn: async () => {
      const data = (
        await nekoHttp.get<CommonResponse<Pagination<T[] | null>>>(
          `/me/favorites/${kind}`,
          { params: { page, per_page: NEKOMAID_FAVORITE_PAGE_SIZE } },
        )
      ).data.data;
      return { ...data, data: data.data ?? [] };
    },
  });
}

export const useNekomaidFavoriteAuthors = (page: number) =>
  useFavoriteList<NekomaidFavoriteAuthor>("authors", page);
export const useNekomaidFavoriteArtworks = (page: number) =>
  useFavoriteList<NekomaidArtwork>("artworks", page);

/**
 * 切換追蹤／收藏：path 是 "authors/site/author" 或 "artworks/site/author/artwork"。
 * 先樂觀更新 key 讓按鈕馬上變，失敗再還原
 */
export function useToggleNekomaidFavorite() {
  const queryClient = useQueryClient();
  const session = useNekomaidSession();
  const keysQueryKey = [favoritesKey, "keys", session?.user.id];
  return useMutation({
    mutationFn: ({ path, on }: { path: string; key: string; on: boolean }) =>
      on
        ? nekoHttp.put(`/me/favorites/${path}`)
        : nekoHttp.delete(`/me/favorites/${path}`),
    onMutate: ({ path, key, on }) => {
      const previous = queryClient.getQueryData<{
        authors: Set<string>;
        artworks: Set<string>;
      }>(keysQueryKey);
      if (previous) {
        const kind = path.startsWith("authors/") ? "authors" : "artworks";
        const next = new Set(previous[kind]);
        if (on) next.add(key);
        else next.delete(key);
        queryClient.setQueryData(keysQueryKey, { ...previous, [kind]: next });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(keysQueryKey, context.previous);
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: [favoritesKey] }),
  });
}

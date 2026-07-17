import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";

const apiBase = import.meta.env.VITE_API_BASE;
const favoritesQueryKey = ["twse-etf", "favorites"];

function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}

export interface TwseEtfFavorite {
  id: number;
  code: string;
  updated_at: string;
}

// 一次撈使用者全部收藏的代號，前端自己用 Set 判斷某代號是否已收藏，
// 避免列表每一列各打一次 API。
export function useTwseEtfFavorites() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...favoritesQueryKey, session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<TwseEtfFavorite[]>>(
        `${apiBase}/opendata/financial/twse/favorites`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useSaveTwseEtfFavorite() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      code,
      favorited,
    }: {
      code: string;
      favorited: boolean;
    }) => {
      const url = `${apiBase}/opendata/financial/twse/${code}/favorite`;
      if (favorited) {
        await axios.post(url, null, {
          headers: sessionHeaders(session!.encrypt_key),
        });
      } else {
        await axios.delete(url, {
          headers: sessionHeaders(session!.encrypt_key),
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
    },
  });
}

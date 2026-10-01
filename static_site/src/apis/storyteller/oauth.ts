import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerOAuthAuthorizeParams,
  StorytellerOAuthAuthorizePreview,
  StorytellerOAuthAuthorizeResult,
  StorytellerOAuthGrant,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

const oauthGrantsQueryKey = ["storyteller", "oauth-grants"];

// 授權頁在登入前就要顯示應用程式名稱與跳轉網域，所以不帶 session；
// 參數錯誤（client_id／redirect_uri 不符）會以 400 回來，由頁面顯示「請求無效」。
export function useStorytellerOAuthAuthorizePreview(
  params: StorytellerOAuthAuthorizeParams,
) {
  return useQuery({
    queryKey: ["storyteller", "oauth-authorize-preview", params],
    retry: false,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerOAuthAuthorizePreview>
      >(`${apiBase}/storyteller/oauth/authorize/preview`, { params });
      return response.data.data;
    },
  });
}

// 使用者按下「允許／拒絕」；成功時回傳要跳轉回應用程式的網址（允許時帶授權碼）。
export function useStorytellerOAuthAuthorize() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (
      input: StorytellerOAuthAuthorizeParams & { approve: boolean },
    ) => {
      const response = await axios.post<
        CommonResponse<StorytellerOAuthAuthorizeResult>
      >(`${apiBase}/storyteller/oauth/authorize`, input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
  });
}

export function useStorytellerOAuthGrants() {
  const { session } = useAuth();
  return useQuery({
    queryKey: [...oauthGrantsQueryKey, session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    queryFn: async () => {
      const response = await axios.get<CommonResponse<StorytellerOAuthGrant[]>>(
        `${apiBase}/storyteller/oauth/grants`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data ?? [];
    },
  });
}

export function useRevokeStorytellerOAuthGrant() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicId: string) => {
      const response = await axios.delete<CommonResponse<{ deleted: boolean }>>(
        `${apiBase}/storyteller/oauth/grants/${publicId}`,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oauthGrantsQueryKey });
    },
  });
}

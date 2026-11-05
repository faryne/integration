import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthSession } from "@/apis/auth/session.ts";
import type { CommonResponse } from "@/apis/interfaces.ts";
import {
  clearNekomaidSession,
  nekoHttp,
  setNekomaidSession,
  useNekomaidSession,
} from "@/apis/nekomaid/accountSession.ts";
import type {
  NekomaidAccount,
  NekomaidActionResult,
  NekomaidLoginRequest,
} from "@/types/nekomaidAccount.ts";

// neko 帳號 API：註冊、登入、忘記密碼都由後端呼叫 Firebase，前端只打自己的後端

/** 後端帳號錯誤帶的原因代碼（見 service/nekomaid/account/errors.go） */
export function accountErrorReason(error: unknown) {
  if (!axios.isAxiosError(error)) return "";
  const data = error.response?.data as
    { data?: { reason?: string; merged_into?: string } } | undefined;
  return data?.data?.reason ?? "";
}

const sessionMutation = (path: string) => async (body: object) =>
  (await nekoHttp.post<CommonResponse<AuthSession>>(path, body)).data.data;

/** 登入（帳號或 email）；成功就存 session */
export function useNekomaidLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NekomaidLoginRequest) =>
      sessionMutation("/auth/login")(input),
    onSuccess: (session) => {
      setNekomaidSession(session);
      void queryClient.invalidateQueries({ queryKey: ["nekomaid-account"] });
    },
  });
}

/** 註冊；成功就直接登入 */
export function useNekomaidRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      sessionMutation("/auth/register")(input),
    onSuccess: (session) => {
      setNekomaidSession(session);
      void queryClient.invalidateQueries({ queryKey: ["nekomaid-account"] });
    },
  });
}

/** 忘記密碼；不論 email 存不存在都會成功 */
export function useNekomaidPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      nekoHttp.post("/auth/password-reset", { email }),
  });
}

/** 信件連結（驗證 email、重設密碼） */
export function useNekomaidAuthAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      mode: string;
      oob_code: string;
      new_password?: string;
    }) =>
      (
        await nekoHttp.post<CommonResponse<NekomaidActionResult>>(
          "/auth/action",
          input,
        )
      ).data.data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nekomaid-account"] });
      void queryClient.invalidateQueries({ queryKey: ["nekomaid-favorites"] });
    },
  });
}

/**
 * 驗證 email 的信件連結：進頁面就送，用 query 而不是 mutation——
 * oobCode 只能用一次，開發模式的 StrictMode 會掛載兩次；query 依 oobCode 去重、結果留在快取，
 * 重新掛載也接得回結果（mutation 狀態在重新掛載後會遺失，畫面會一直轉圈）。
 */
export function useNekomaidVerifyEmail(oobCode: string, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["nekomaid-verify-email", oobCode],
    enabled: enabled && Boolean(oobCode),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const result = (
        await nekoHttp.post<CommonResponse<NekomaidActionResult>>(
          "/auth/action",
          { mode: "verifyEmail", oob_code: oobCode },
        )
      ).data.data;
      void queryClient.invalidateQueries({ queryKey: ["nekomaid-account"] });
      void queryClient.invalidateQueries({ queryKey: ["nekomaid-favorites"] });
      return result;
    },
  });
}

/** 目前登入者（頁首名稱、未驗證提示條）；沒登入不查 */
export function useNekomaidAccount() {
  const session = useNekomaidSession();
  return useQuery({
    queryKey: ["nekomaid-account", session?.user.id],
    enabled: Boolean(session),
    retry: false,
    queryFn: async () =>
      (await nekoHttp.get<CommonResponse<NekomaidAccount>>("/auth/session"))
        .data.data,
  });
}

/** 登出：後端刪 session 失敗也照樣清掉本機的 */
export function useNekomaidLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => nekoHttp.delete("/auth/session").catch(() => undefined),
    onSettled: () => {
      clearNekomaidSession();
      queryClient.removeQueries({ queryKey: ["nekomaid-account"] });
      queryClient.removeQueries({ queryKey: ["nekomaid-favorites"] });
    },
  });
}

import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { isSteamLoomSite, STEAMLOOM_PATH_PREFIX } from "@/helpers/steamloom.ts";

// storyteller 的使用者系統已經跟主站 users 表脫鉤（見 service/auth/session.go 的
// RedisSession.Brand），登入/續期一定要打 storyteller 專屬的端點，不能再走共用的
// /auth/session——後端會直接判 session brand mismatch 回 401。destroyAuthSession
// 不用分流：DELETE /auth/session 純粹靠 encrypt_key 刪 Redis key，不檢查 brand。
//
// isLocalStorytellerDevTest 只給本機開發測試用：正式網域靠 isSteamLoomSite()
// 判斷網域名稱就夠了，但 storyteller 本機開發網址是 localhost + /storyteller
// 前綴（見 steamloomPath()），不是真的 steamloom.works，isSteamLoomSite() 永遠
// 判 false。不能直接把這個路徑判斷塞進 isSteamLoomSite() 本身——steamloomPath()
// 就是靠它才決定要不要加這個前綴，兩者會互相依賴造成本機路由整個壞掉，所以只在
// 這個檔案（登入端點的選擇）額外疊加這個判斷，且限定只在 dev build 生效。
const isLocalStorytellerDevTest =
  import.meta.env.DEV &&
  window.location.pathname.startsWith(STEAMLOOM_PATH_PREFIX);
const sessionEndpoint =
  isSteamLoomSite() || isLocalStorytellerDevTest
    ? `${STEAMLOOM_PATH_PREFIX}/auth/session`
    : "/auth/session";

export interface AuthUser {
  id: number;
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  is_admin: boolean;
}

export interface AuthSession {
  user: AuthUser;
  encrypt_key: string;
  expires_at: string;
}

export async function createAuthSession(idToken: string) {
  const response = await axios.post<CommonResponse<AuthSession>>(
    `${import.meta.env.VITE_API_BASE}${sessionEndpoint}`,
    null,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );
  return response.data.data;
}

// proactive renewal 用：不換 encrypt_key，只是打一次 API 讓後端 sliding TTL 續期，
// 新的 expires_at 會從 response header 回來，由 axios interceptor 更新 sessionStore。
export async function touchAuthSession(encryptKey: string) {
  await axios.get(`${import.meta.env.VITE_API_BASE}${sessionEndpoint}`, {
    headers: {
      "X-Encrypt-Key": encryptKey,
    },
  });
}

export async function destroyAuthSession(encryptKey: string) {
  const response = await axios.delete<CommonResponse<{ destroyed: boolean }>>(
    `${import.meta.env.VITE_API_BASE}/auth/session`,
    {
      headers: {
        "X-Encrypt-Key": encryptKey,
      },
    },
  );
  return response.data.data;
}

export function useCreateAuthSession() {
  return useMutation({
    mutationFn: async (idToken: string) => ({
      data: await createAuthSession(idToken),
    }),
  });
}

export function useDestroyAuthSession() {
  return useMutation({
    mutationFn: async (encryptKey: string) => ({
      data: await destroyAuthSession(encryptKey),
    }),
  });
}

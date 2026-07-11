import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import type { CommonResponse } from "@/apis/interfaces.ts";

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
    `${import.meta.env.VITE_API_BASE}/auth/session`,
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
  await axios.get(`${import.meta.env.VITE_API_BASE}/auth/session`, {
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

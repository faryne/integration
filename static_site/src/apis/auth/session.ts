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

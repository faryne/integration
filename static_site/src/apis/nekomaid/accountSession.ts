import axios from "axios";
import { useSyncExternalStore } from "react";

import type { AuthSession } from "@/apis/auth/session.ts";

// neko.maid.tw 的登入 session：跟主站分開存（不同 key、不同 axios 實例）。
// 本機 neko 掛在 localhost/nekomaid、跟主站同源，若共用主站的 sessionStore 與全域 axios 攔截器，
// neko 的 401 會把主站 session 清掉、續期 header 也會蓋到主站的 expires_at。
const storageKey = "nekomaid.auth.session";
const SESSION_EXPIRES_HEADER = "x-session-expires-at";

type Listener = () => void;
const listeners = new Set<Listener>();

function readStored(): AuthSession | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as AuthSession) : null;
    return parsed && new Date(parsed.expires_at).getTime() > Date.now()
      ? parsed
      : null;
  } catch {
    return null;
  }
}

let session: AuthSession | null =
  typeof window === "undefined" ? null : readStored();

function write(next: AuthSession | null) {
  session = next;
  try {
    if (next) localStorage.setItem(storageKey, JSON.stringify(next));
    else localStorage.removeItem(storageKey);
  } catch {
    // 無痕模式等存不了：只留在記憶體，重新整理就要重新登入
  }
  for (const listener of listeners) listener();
}

export const setNekomaidSession = (next: AuthSession) => write(next);
export const clearNekomaidSession = () => session && write(null);
export const getNekomaidSession = () => session;

/** 目前的 neko session（React 元件用） */
export function useNekomaidSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => session,
  );
}

/** neko 專用的 axios：自動帶 session、續期；401 就清掉 neko session（不碰主站） */
export const nekoHttp = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE}/nekomaid`,
});

nekoHttp.interceptors.request.use((config) => {
  if (session) config.headers.set("X-Encrypt-Key", session.encrypt_key);
  return config;
});

nekoHttp.interceptors.response.use(
  (response) => {
    const expiresAt = response.headers[SESSION_EXPIRES_HEADER];
    if (
      typeof expiresAt === "string" &&
      session &&
      session.expires_at !== expiresAt
    ) {
      write({ ...session, expires_at: expiresAt });
    }
    return response;
  },
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config?.headers.has("X-Encrypt-Key")
    ) {
      clearNekomaidSession();
    }
    return Promise.reject(error);
  },
);

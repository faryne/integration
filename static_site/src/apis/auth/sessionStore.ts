import type { AuthSession } from "@/apis/auth/session.ts";
import {
  getStoredAuthSession,
  removeStoredAuthSession,
  setStoredAuthSession,
} from "@/apis/auth/storage.ts";

// AuthProvider（React 元件樹內）與 axios interceptor（元件樹外）都需要讀寫同一份
// session 狀態，所以獨立成一個外部 store，兩邊透過 subscribe/getSnapshot 對齊。
type Listener = () => void;

let session: AuthSession | null = getStoredAuthSession();
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSession(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionSnapshot() {
  return session;
}

export function setSession(next: AuthSession) {
  session = next;
  setStoredAuthSession(next);
  emit();
}

export function clearSession() {
  if (session === null) {
    return;
  }
  session = null;
  removeStoredAuthSession();
  emit();
}

// sliding TTL：每次 API 回應帶回新的 expires_at 時就地更新，不用整包重建 session
export function touchSessionExpiry(expiresAt: string) {
  if (!session || session.expires_at === expiresAt) {
    return;
  }
  session = { ...session, expires_at: expiresAt };
  setStoredAuthSession(session);
  emit();
}

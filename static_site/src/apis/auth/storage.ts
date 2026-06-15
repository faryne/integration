import type { AuthSession } from "@/apis/auth/session.ts";

export const authSessionStorageKey = "faryne.auth.session";

export function getStoredAuthSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(authSessionStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AuthSession;
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(authSessionStorageKey);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(authSessionStorageKey);
    return null;
  }
}

export function setStoredAuthSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(authSessionStorageKey, JSON.stringify(session));
}

export function removeStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(authSessionStorageKey);
}

import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { createAuthSession, type AuthSession } from "@/apis/auth/session.ts";
import { clearSession, setSession, touchSessionExpiry } from "@/apis/auth/sessionStore.ts";
import { getFirebaseAuth } from "@/lib/firebase.ts";

const SESSION_EXPIRES_HEADER = "x-session-expires-at";
const ENCRYPT_KEY_HEADER = "X-Encrypt-Key";

interface RetriableConfig extends InternalAxiosRequestConfig {
  _sessionRetried?: boolean;
}

// 拿目前登入者的 Firebase ID token 換一把新的 encrypt_key，多個請求同時 401 時共用同一個
// in-flight promise，避免併發打好幾次 /auth/session。任何一步失敗（含 refresh token 失效）
// 就代表這個使用者真的無法再靜默續期，交給呼叫端 clearSession()。
let rebuildPromise: Promise<AuthSession> | null = null;

async function rebuildSession(): Promise<AuthSession> {
  const firebaseAuth = getFirebaseAuth();
  const currentUser = firebaseAuth?.auth.currentUser;
  if (!firebaseAuth || !currentUser) {
    throw new Error("尚未登入 Firebase，無法靜默續期");
  }
  await firebaseAuth.persistenceReady;
  const idToken = await currentUser.getIdToken(true);
  const nextSession = await createAuthSession(idToken);
  setSession(nextSession);
  return nextSession;
}

export function installAuthInterceptors() {
  axios.interceptors.response.use((response) => {
    const expiresAt = response.headers[SESSION_EXPIRES_HEADER];
    if (typeof expiresAt === "string") {
      touchSessionExpiry(expiresAt);
    }
    return response;
  });

  axios.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const headers =
      config?.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config?.headers);

    if (
      error.response?.status !== 401 ||
      !config ||
      !headers.has(ENCRYPT_KEY_HEADER) ||
      config._sessionRetried
    ) {
      return Promise.reject(error);
    }
    config._sessionRetried = true;

    try {
      rebuildPromise ??= rebuildSession().finally(() => {
        rebuildPromise = null;
      });
      const nextSession = await rebuildPromise;
      headers.set(ENCRYPT_KEY_HEADER, nextSession.encrypt_key);
      config.headers = headers;
      return axios(config);
    } catch {
      clearSession();
      return Promise.reject(error);
    }
  });
}

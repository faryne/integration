import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createAuthSession,
  destroyAuthSession,
  touchAuthSession,
} from "@/apis/auth/session.ts";
import {
  clearSession as clearStoredSession,
  getSessionSnapshot,
  setSession as setStoredSession,
  subscribeSession,
} from "@/apis/auth/sessionStore.ts";
import { getFirebaseAuth } from "@/lib/firebase.ts";
import { AuthContext } from "@/components/auth/AuthContext.ts";

// session 快過期前的續期緩衝：提早這麼久主動 touch 一次，一般使用情境下根本不會撞到 401。
const RENEW_BEFORE_EXPIRY_MS = 30 * 60 * 1000;
const MIN_RENEW_DELAY_MS = 5 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebaseAuth = useMemo(() => getFirebaseAuth(), []);
  const [user, setUser] = useState<User | null>(null);
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));
  const [submitting, setSubmitting] = useState(false);
  const sessionSyncAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    let unsubscribe = () => {};
    let active = true;
    void firebaseAuth.persistenceReady
      .then(() => {
        if (!active) {
          return;
        }
        unsubscribe = onAuthStateChanged(firebaseAuth.auth, (currentUser) => {
          setUser(currentUser);
          if (!currentUser) {
            clearStoredSession();
          }
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));

    return () => {
      active = false;
      unsubscribe();
    };
  }, [firebaseAuth]);

  const establishSession = async (currentUser: User) => {
    const idToken = await currentUser.getIdToken();
    const nextSession = await createAuthSession(idToken);
    setStoredSession(nextSession);
  };

  useEffect(() => {
    if (!user) {
      sessionSyncAttempted.current = null;
      return;
    }

    if (session && session.user.firebase_uid !== user.uid) {
      clearStoredSession();
      return;
    }

    if (session || sessionSyncAttempted.current === user.uid) {
      return;
    }

    sessionSyncAttempted.current = user.uid;
    setSubmitting(true);
    void establishSession(user)
      .catch(() => {
        sessionSyncAttempted.current = null;
      })
      .finally(() => setSubmitting(false));
  }, [session, user]);

  // proactive renewal：expires_at 一有變動（含 sliding TTL 續期）就重新排程，
  // 在真的過期前主動 touch 一次，讓開著分頁不動作的使用者也不會撞到 401。
  useEffect(() => {
    if (!session?.encrypt_key) {
      return;
    }

    const delay = Math.max(
      new Date(session.expires_at).getTime() -
        Date.now() -
        RENEW_BEFORE_EXPIRY_MS,
      MIN_RENEW_DELAY_MS,
    );
    const timer = window.setTimeout(() => {
      void touchAuthSession(session.encrypt_key).catch(() => {
        // 續期失敗（session 已在別處失效）交給 axios interceptor 的 401 流程處理
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [session?.encrypt_key, session?.expires_at]);

  const login = async () => {
    if (!firebaseAuth) {
      throw new Error("Firebase Authentication 尚未設定");
    }
    setSubmitting(true);
    try {
      await firebaseAuth.persistenceReady;
      const currentUser =
        firebaseAuth.auth.currentUser ??
        (await signInWithPopup(firebaseAuth.auth, firebaseAuth.googleProvider))
          .user;
      await establishSession(currentUser);
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    if (!firebaseAuth) {
      return;
    }
    setSubmitting(true);
    try {
      if (session?.encrypt_key) {
        await destroyAuthSession(session.encrypt_key);
      }
      await signOut(firebaseAuth.auth);
      clearStoredSession();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, submitting, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

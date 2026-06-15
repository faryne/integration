import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  createAuthSession,
  destroyAuthSession,
  type AuthSession,
} from "@/apis/auth/session.ts";
import {
  getStoredAuthSession,
  removeStoredAuthSession,
  setStoredAuthSession,
} from "@/apis/auth/storage.ts";
import { getFirebaseAuth } from "@/lib/firebase.ts";
import { AuthContext } from "@/components/auth/AuthContext.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebaseAuth = useMemo(() => getFirebaseAuth(), []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(() =>
    getStoredAuthSession(),
  );
  const [loading, setLoading] = useState(Boolean(firebaseAuth));
  const [submitting, setSubmitting] = useState(false);
  const sessionSyncAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth.auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setSession(null);
        removeStoredAuthSession();
      }
      setLoading(false);
    });
  }, [firebaseAuth]);

  const establishSession = async (currentUser: User) => {
    const idToken = await currentUser.getIdToken();
    const nextSession = await createAuthSession(idToken);
    setSession(nextSession);
    setStoredAuthSession(nextSession);
  };

  useEffect(() => {
    if (!user) {
      sessionSyncAttempted.current = null;
      return;
    }

    if (session && session.user.firebase_uid !== user.uid) {
      setSession(null);
      removeStoredAuthSession();
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

  const login = async () => {
    if (!firebaseAuth) {
      throw new Error("Firebase Authentication 尚未設定");
    }
    setSubmitting(true);
    try {
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
      setSession(null);
      removeStoredAuthSession();
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

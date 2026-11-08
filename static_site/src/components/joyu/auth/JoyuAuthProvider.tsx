import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";

import {
  deleteJoyuAccountData,
  mergeAnonymousFollows,
} from "@/apis/av/joyu_me.ts";
import { getJoyuAuth, joyuGoogleProvider } from "@/lib/joyuFirebase.ts";

import { JoyuAuthContext } from "./JoyuAuthContext.ts";

const errorCode = (e: unknown) => (e instanceof FirebaseError ? e.code : "");

/**
 * joyu.fyi 的登入狀態（掛在 JoyuLayout）：Google 登入＋匿名登入，沒有 session。
 * 匿名帳號在第一次按愛心時才建立；升級成 Google 帳號時 uid 不變，追蹤自然保留。
 * 規格見 DevelopDocuments/opendata/joyu.fyi社群功能第一期_2026-11-08.md
 */
export function JoyuAuthProvider({ children }: { children: ReactNode }) {
  const fb = getJoyuAuth();
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(fb));
  // 匿名帳號升級成 Google 時 Firebase 是原地改同一個 User 物件（isAnonymous 變 false），state 參考沒變，靠這個強制重畫
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!fb) return;
    let unsubscribe = () => {};
    void fb.ready.then(() => {
      unsubscribe = onAuthStateChanged(fb.auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    });
    return () => unsubscribe();
  }, [fb]);

  const requireAuth = () => {
    if (!fb) throw new Error("joyu Firebase 尚未設定");
    return fb.auth;
  };

  const loginWithGoogle = async () => {
    const auth = requireAuth();
    const current = auth.currentUser;
    if (!current?.isAnonymous) {
      await signInWithPopup(auth, joyuGoogleProvider());
      return;
    }
    try {
      // 匿名帳號直接升級：uid 不變，追蹤不用搬
      await linkWithPopup(current, joyuGoogleProvider());
      setVersion((v) => v + 1);
    } catch (e) {
      if (errorCode(e) !== "auth/credential-already-in-use") throw e;
      // 這個 Google 帳號之前就登入過：改登入那個帳號，再把匿名帳號的追蹤搬過去
      const credential = GoogleAuthProvider.credentialFromError(
        e as FirebaseError,
      );
      if (!credential) throw e;
      const anonymousToken = await current.getIdToken();
      await signInWithCredential(auth, credential);
      await mergeAnonymousFollows(anonymousToken);
      await qc.invalidateQueries({ queryKey: ["joyu/follows"] });
    }
  };

  const logout = async () => {
    await signOut(requireAuth());
    qc.removeQueries({ queryKey: ["joyu/follows"] });
    qc.removeQueries({ queryKey: ["joyu/feed"] });
  };

  const ensureUser = async () => {
    const auth = requireAuth();
    return auth.currentUser ?? (await signInAnonymously(auth)).user;
  };

  const deleteAccount = async () => {
    const auth = requireAuth();
    const current = auth.currentUser;
    if (!current) return;
    await deleteJoyuAccountData();
    try {
      await current.delete();
    } catch (e) {
      if (errorCode(e) !== "auth/requires-recent-login") throw e;
      // Google 帳號登入太久了，Firebase 要求重新驗證一次才能刪
      await reauthenticateWithPopup(current, joyuGoogleProvider());
      await current.delete();
    }
    qc.removeQueries({ queryKey: ["joyu/follows"] });
    qc.removeQueries({ queryKey: ["joyu/feed"] });
  };

  return (
    <JoyuAuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        logout,
        ensureUser,
        deleteAccount,
      }}
    >
      {children}
    </JoyuAuthContext.Provider>
  );
}

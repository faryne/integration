import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

// joyu.fyi 的登入狀態（JoyuAuthProvider 提供）。沒有 session：API 每次帶 ID token（apis/av/joyu_me.ts）
export interface JoyuAuthValue {
  /** Firebase 使用者；匿名帳號也算登入（isAnonymous 為 true） */
  user: User | null;
  loading: boolean;
  /** Google 登入；匿名帳號會升級成 Google 帳號（追蹤保留） */
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** 沒登入就先建立匿名帳號；第一次按愛心時才呼叫，不在開頁時建立 */
  ensureUser: () => Promise<User>;
  /** 刪除帳號：先刪後端的追蹤，再刪 Firebase 帳號 */
  deleteAccount: () => Promise<void>;
}

export const JoyuAuthContext = createContext<JoyuAuthValue | null>(null);

export function useJoyuAuth() {
  const value = useContext(JoyuAuthContext);
  if (!value) throw new Error("useJoyuAuth 要在 JoyuAuthProvider 裡面用");
  return value;
}

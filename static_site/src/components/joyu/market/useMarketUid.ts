import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";

/** 股市用的 uid：只有 Google 帳號才有（匿名帳號不能開戶），沒有就回 undefined；loading 時也是 undefined */
export function useMarketUid() {
  const { user, loading } = useJoyuAuth();
  return { uid: user && !user.isAnonymous ? user.uid : undefined, loading };
}

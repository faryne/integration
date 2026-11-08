import { useState, type MouseEvent } from "react";

import {
  useJoyuFollows,
  useToggleFollow,
  type FollowKind,
} from "@/apis/av/joyu_me.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { joyuFirebaseReady } from "@/lib/joyuFirebase.ts";

import { useJoyuAuth } from "./auth/JoyuAuthContext.ts";

/**
 * 追蹤按鈕共用的邏輯（愛心 FollowButton、影片搜尋頁的「追蹤這個搜尋」）：
 * 目前是否已追蹤、點擊切換（沒登入先建立匿名帳號，不跳登入）、失敗訊息。
 * click 會擋掉預設行為與冒泡，放在連結或可點的 chip 裡也不會觸發外層
 */
export function useFollowToggle(kind: FollowKind, value: string) {
  const { user, ensureUser } = useJoyuAuth();
  const follows = useJoyuFollows(user?.uid);
  const toggle = useToggleFollow();
  const [error, setError] = useState("");
  const on = Boolean(
    follows.data?.some((f) => f.kind === kind && f.value === value),
  );
  const click = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const u = await ensureUser();
      await toggle.mutateAsync({
        uid: u.uid,
        follow: { kind, value },
        on: !on,
      });
    } catch (err) {
      setError(apiErrorMessage(err, "追蹤失敗，請稍後再試"));
    }
  };
  return {
    ready: joyuFirebaseReady,
    on,
    click,
    error,
    clearError: () => setError(""),
  };
}

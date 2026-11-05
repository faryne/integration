import { isNekomaidSite, nekomaidPath } from "@/helpers/nekomaid.ts";

// neko 帳號相關的路徑與開關

/**
 * 帳號與追蹤只在 neko.maid.tw 開（faryne.dev/nekomaid 是主站 brand，不顯示登入與愛心）；
 * 本機開發走 localhost/nekomaid，dev build 也打開方便測試
 */
export const nekomaidAccountEnabled = () =>
  isNekomaidSite() || import.meta.env.DEV;

/** 登入頁；redirect 是登入後要回去的站內路徑 */
export const nekomaidLoginPath = (redirect = "") =>
  nekomaidPath(
    redirect ? `login?redirect=${encodeURIComponent(redirect)}` : "login",
  );

export const nekomaidRegisterPath = () => nekomaidPath("register");
export const nekomaidForgotPasswordPath = () => nekomaidPath("forgot-password");
export const nekomaidMePath = () => nekomaidPath("me");

/** 登入後回去的路徑：只接受站內相對路徑，避免被拿來導到外站 */
export function safeRedirect(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : nekomaidPath();
}

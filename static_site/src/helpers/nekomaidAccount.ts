import { isNekomaidSite, nekomaidPath } from "@/helpers/nekomaid.ts";

// neko 帳號相關的路徑與開關

/**
 * 帳號與追蹤只在 neko.maid.tw 開（faryne.dev/nekomaid 是主站 brand，不顯示登入與愛心），
 * 而且要用 VITE_NEKOMAID_ACCOUNT_ENABLED=true 建置才會打開（後端對應 NEKOMAID_ACCOUNT_ENABLED）；
 * Firebase 動作網址設定好之前先關著。本機開發（dev build）一律打開方便測試
 */
export const nekomaidAccountEnabled = () =>
  import.meta.env.DEV ||
  (isNekomaidSite() &&
    import.meta.env.VITE_NEKOMAID_ACCOUNT_ENABLED === "true");

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

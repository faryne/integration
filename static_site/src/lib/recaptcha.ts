import { isJoyuSite } from "@/helpers/joyu.ts";

// joyu.fyi 的 reCAPTCHA Enterprise（Google Fraud Defense）：上稿表單送出前取得 token，放在 X-Recaptcha-Token header，
// 後端 controller/opendata 的 verifyAvRecaptcha 驗證。沒設 site key 或不在 joyu 網域時不載入、不帶 token（後端沒設定也會放行）

const siteKey = import.meta.env.VITE_JOYU_RECAPTCHA_SITE_KEY as
  string | undefined;

/** action 名稱要跟後端 service/recaptcha 的常數一致 */
export type RecaptchaAction =
  "ACTRESS_SUBMIT" | "VIDEO_SUBMIT" | "JOYU_COMMENT";

interface Grecaptcha {
  enterprise: {
    ready: (cb: () => void) => void;
    execute: (key: string, options: { action: string }) => Promise<string>;
  };
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const enabled = () => Boolean(siteKey) && isJoyuSite();

let loading: Promise<Grecaptcha | undefined> | null = null;

/** 載入 reCAPTCHA script（只載一次）。表單頁一打開就呼叫：越早載入，風險分數依據的瀏覽行為越完整 */
export function loadRecaptcha() {
  if (!enabled()) return Promise.resolve(undefined);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`;
    script.async = true;
    script.onload = () =>
      window.grecaptcha?.enterprise.ready(() => resolve(window.grecaptcha));
    // 載入失敗（被擋廣告的擴充套件擋掉等）時不帶 token，交給後端決定
    script.onerror = () => {
      loading = null;
      resolve(undefined);
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** 送出前呼叫：回傳要帶在 request 的 header；沒啟用或取不到 token 時回空物件 */
export async function recaptchaHeaders(
  action: RecaptchaAction,
): Promise<Record<string, string>> {
  const g = await loadRecaptcha();
  if (!g || !siteKey) return {};
  try {
    return {
      "X-Recaptcha-Token": await g.enterprise.execute(siteKey, { action }),
    };
  } catch {
    return {};
  }
}

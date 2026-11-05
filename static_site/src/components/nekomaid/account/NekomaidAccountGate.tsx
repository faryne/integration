import type { ReactNode } from "react";

import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { nekomaidAccountEnabled } from "@/helpers/nekomaidAccount.ts";

/**
 * 帳號相關頁面（登入、註冊、忘記密碼、信件連結、我的追蹤）的路由守門：
 * 帳號功能沒開時一律 404，避免 /login 之類的路徑被 /:site 搜尋路由吃掉
 */
export function NekomaidAccountGate({ children }: { children: ReactNode }) {
  return nekomaidAccountEnabled() ? children : <ErrorPage code={404} />;
}

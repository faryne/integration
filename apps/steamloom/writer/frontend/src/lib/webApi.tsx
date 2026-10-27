import { AuthContext, type AuthContextValue } from "@/components/auth/AuthContext.ts";
import { apiBase } from "@/apis/storyteller/shared.ts";
import { isClientHttpError } from "@/helpers/httpError.ts";
import { SeoDisabledContext } from "@/helpers/title.tsx";
import { StorytellerAppearanceContext } from "@/layouts/storytellerAppearanceMode.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { backend, errorMessage, isNotLoggedIn } from "@writer/lib/backend.ts";
import i18n from "@writer/i18n/index.ts";

// 讓網站的 API hook（static_site/src/apis/storyteller/*，axios＋react-query）直接在 Writer 裡跑：
// axios 的 adapter 換成走 Go 綁定 ApiProxy，由 Go 帶 Bearer 打同一組 /storyteller 路由，token 不進 JS、不用開 CORS。
// 網站元件因此不用為了 Writer 另外改成 props／context 注入資料，整頁搬過來就能用（例如梭梭的記憶）。
// 限制：
// - 只轉發 `${apiBase}/storyteller/...`，其他網址（S3 presign 直傳、外部服務）會直接 reject
// - body 只支援 JSON（FormData／Blob 會 reject）
// - 掛 sessionOnly 的端點（帳號安全、Provider 金鑰、PAT、站內 AI…）Bearer 打不到，會回 403，這類頁面不要搬

const storytellerPrefix = `${apiBase}/storyteller`;

// 授權失效（Go 回 not_logged_in）時通知外層回登入頁；由 WebApiProvider 註冊
let onSessionExpired: (() => void) | null = null;

const writerAdapter: AxiosAdapter = async (config) => {
  // getUri 會把 params 序列化進 query string，跟瀏覽器實際送出的網址一致
  const url = axios.getUri(config);
  if (!url.startsWith(`${storytellerPrefix}/`)) {
    throw new AxiosError(i18n.t("app.apiProxy.unsupportedUrl", { url }), AxiosError.ERR_NOT_SUPPORT, config);
  }
  // transformRequest 跑完後物件已經是 JSON 字串；不是字串就是 FormData 之類，Go 那邊無法轉發
  if (config.data != null && typeof config.data !== "string") {
    throw new AxiosError(i18n.t("app.apiProxy.jsonOnly"), AxiosError.ERR_NOT_SUPPORT, config);
  }
  const method = (config.method ?? "get").toUpperCase();
  let proxied;
  try {
    proxied = await backend.ApiProxy(method, url.slice(storytellerPrefix.length), config.data ?? "");
  } catch (err) {
    if (isNotLoggedIn(err)) onSessionExpired?.();
    throw new AxiosError(errorMessage(err), AxiosError.ERR_NETWORK, config);
  }
  // data 給原始字串，交給 axios 自己的 transformResponse 解析 JSON（錯誤回應也一樣，網站讀 response.data.custom_code 不用改）
  const response: AxiosResponse = {
    data: proxied.body,
    status: proxied.status,
    statusText: "",
    headers: new AxiosHeaders({ "content-type": proxied.content_type }),
    config,
    request: null,
  };
  if (config.validateStatus && !config.validateStatus(response.status)) {
    const code = response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST;
    throw new AxiosError(`Request failed with status code ${response.status}`, code, config, null, response);
  }
  return response;
};

// 全域 axios 只有 Writer 自己這份（static_site 的檔案 import axios 一律解析到 Writer 的 node_modules，見 vite.config.ts）
axios.defaults.adapter = writerAdapter;

// 網站 hook 都從 useAuth() 拿 session：只用來當 enabled 條件、header 與 queryKey，實際授權由 Go 帶 Bearer。
// Writer 一次只會登入一位作者，user.id 固定 0；換人登入時整個 provider 會重新掛載，快取不會串到別人。
const writerAuth: AuthContextValue = {
  user: null,
  session: {
    user: { id: 0, firebase_uid: "", email: null, display_name: null, photo_url: null, is_admin: false },
    encrypt_key: "writer",
    expires_at: "",
  },
  loading: false,
  submitting: false,
  login: async () => undefined,
  logout: async () => undefined,
};

// Writer 外觀固定 nocturne（見 App.tsx）；網站元件（例如 StorytellerLoading、梭梭插圖）要讀外觀，
// 不提供會直接丟錯讓整頁空白。Writer 不讓作者切換外觀，setAppearance 不做事。
const writerAppearance = { appearance: "nocturne" as const, setAppearance: () => undefined };

// 包住要用網站 API hook 的區塊：react-query、假 session，與網站頁面用到 useSearchParams 等 router hook 時需要的 MemoryRouter
// 只在已登入時掛載：登出就整個卸載，react-query 快取跟著丟掉
export function WebApiProvider({ onExpired, children }: { onExpired: () => void; children: ReactNode }) {
  useEffect(() => {
    onSessionExpired = onExpired;
    return () => {
      onSessionExpired = null;
    };
  }, [onExpired]);
  // 授權失效、4xx（找不到／沒權限）都不重試，免得同一個錯誤連打三次；跟網站 main.tsx 的全域 retry 規則一致
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, err) => count < 3 && !isNotLoggedIn((err as AxiosError).message) && !isClientHttpError(err),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={writerAuth}>
        {/* 網站頁面的 useTitle／useSeo 會改 document.title（＝Writer 視窗標題），在 Writer 裡一律停用 */}
        <SeoDisabledContext.Provider value={true}>
          <StorytellerAppearanceContext.Provider value={writerAppearance}>
            <MemoryRouter>{children}</MemoryRouter>
          </StorytellerAppearanceContext.Provider>
        </SeoDisabledContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

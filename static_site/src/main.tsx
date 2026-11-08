import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/auth/AuthProvider.tsx";
import { installAuthInterceptors } from "@/apis/auth/httpInterceptors.ts";
import { isClientHttpError } from "@/helpers/httpError.ts";
import { isJoyuSite } from "@/helpers/joyu.ts";
// 初始化 i18n（side-effect import，要在任何元件渲染前）
import "@/i18n/index.ts";

installAuthInterceptors();

// 全域 retry：4xx 直接失敗，只有 5xx／網路錯誤才沿用預設的最多 3 次。
// 不這樣做的話，網址帶錯 id 時每支 query 都要等 1s→2s→4s 退避才出 404。
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !isClientHttpError(error) && failureCount < 3,
      // joyu.fyi 的 AV 資料只隨每日同步變動：5 分鐘內切頁、回上一頁、切回分頁都不重打 API。其他站維持預設（0）
      ...(isJoyuSite() && { staleTime: 5 * 60 * 1000 }),
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

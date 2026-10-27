import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/auth/AuthProvider.tsx";
import { installAuthInterceptors } from "@/apis/auth/httpInterceptors.ts";
import { isClientHttpError } from "@/helpers/httpError.ts";
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

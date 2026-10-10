import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/auth/AuthProvider.tsx";
import { installAuthInterceptors } from "@/apis/auth/httpInterceptors.ts";
// 初始化 i18n（side-effect import，要在任何元件渲染前）
import "@/i18n/index.ts";

installAuthInterceptors();

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

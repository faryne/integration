import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 網站前端（static_site）的原始碼；Writer 直接 import 共用的主題與元件，不另外複製一份。
// 新增共用檔案時，要同步補進 .github/workflows/steamloom-writer.yml 的 paths，否則改那個檔案不會觸發 Writer 編譯。
const webSrc = path.resolve(__dirname, "../../../../static_site/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@steamloom-web": webSrc,
    },
    // static_site 底下的檔案會往上找到 static_site/node_modules，強制這些套件只用 Writer 自己這份，
    // 否則會出現兩份 React／MUI（hook 失效、ThemeProvider 對不上）
    dedupe: ["react", "react-dom", "@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
  },
  server: {
    // 允許 dev server 讀取 repo 內 static_site 的檔案
    fs: { allow: [path.resolve(__dirname, "../../../..")] },
  },
});

import path from "path";
import { defineConfig } from "vitest/config";

// 獨立於 vite.config.ts，避免牽動正式 build 用的自訂 plugin（contact 加密、chunk
// 命名）。目前只給 wysiwygCore 的 command registry smoke test 用，需要 jsdom
// 是因為 Tiptap Editor 內部會碰 DOM API，即使測試不真的把編輯器掛到畫面上。
export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

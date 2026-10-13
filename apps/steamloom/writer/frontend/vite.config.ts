import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath, type Plugin } from "vite";

// 網站前端（static_site）的原始碼；Writer 直接 import 共用的元件（主題、編輯器、版本比對…），不另外複製一份。
// "@/" 留給 static_site（網站檔案內部本來就用 "@/"，不用改寫），Writer 自己的程式用 "@writer/"。
// 新增共用檔案時，要同步補進 .github/workflows/steamloom-writer.yml 的 paths，否則改那個檔案不會觸發 Writer 編譯。
const webSrc = path.resolve(__dirname, "../../../../static_site/src");
const writerSrc = path.resolve(__dirname, "./src");
// Vite 給的 importer 一律是正斜線路徑（Windows 也是 D:/a/...），path.resolve 在 Windows 卻是反斜線，
// 比對前要先轉成同一種格式，否則 Windows 上永遠比對不到、static_site 的套件就解析失敗
const webSrcPrefix = `${normalizePath(webSrc)}/`;

// static_site 的檔案 import 第三方套件時，一律改從 Writer 自己的 node_modules 解析：
// 本機 static_site 有自己的 node_modules（會變成兩份 React／MUI，hook 失效、ThemeProvider 對不上），
// CI 則根本沒有（直接解析失敗）。統一以 Writer 為準，不用逐一列 dedupe。
function resolveSharedDepsFromWriter(): Plugin {
  return {
    name: "resolve-shared-deps-from-writer",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const isBare = !/^[./\0]/.test(source) && !source.startsWith("@/");
      if (!isBare || !importer || !normalizePath(importer).startsWith(webSrcPrefix)) return null;
      const resolved = await this.resolve(source, path.join(writerSrc, "main.tsx"), { ...options, skipSelf: true });
      // 找不到時不能回 null：Vite 會退回 static_site/node_modules，本機編得過、CI 卻失敗
      if (!resolved) this.error(`${path.relative(webSrc, importer)} 用到 ${source}，Writer 沒有安裝；請在 Writer 裝跟網站相同的版本`);
      return resolved;
    },
  };
}

export default defineConfig({
  plugins: [resolveSharedDepsFromWriter(), react()],
  resolve: {
    alias: {
      "@writer": writerSrc,
      "@steamloom-web": webSrc,
      "@": webSrc,
    },
  },
  server: {
    // 允許 dev server 讀取 repo 內 static_site 的檔案
    fs: { allow: [path.resolve(__dirname, "../../../..")] },
  },
});

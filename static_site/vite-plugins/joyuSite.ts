import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

// joyu.fyi 跟其他站共用同一份 index.html，裡面寫死的是 faryne.dev 的品牌（站名、描述、canonical、
// favicon、預覽圖）和 AdSense script。joyu 刻意跟主站切割，不執行 JS 的爬蟲也不該看到這些：
// joyu 的 build（VITE_SITE=joyu）直接換掉 HTML 裡的品牌資訊、拔掉 AdSense，並補上成人內容標記。
// 描述跟後端 service/sns/meta.go 的 joyuDescription、前端 helpers/title.tsx 同一句，改的時候三邊一起改。
const faryneSiteName = "Faryne 的實驗室 by faryne.dev";
const faryneDescription =
  "Faryne 的個人實驗室，整理開放資料、ETF 與匯率工具、爬蟲工具、Threads 截圖工具，以及一些 side project。";
const joyuSiteName = "joyu.fyi";
const joyuDescription =
  "整理 AV 女優資料與作品索引：用名字、別名、主題找女優，查看出演作品與番號。";

export function joyuSitePlugin(enabled: boolean): Plugin {
  return {
    name: "joyu-site",
    apply: "build",
    transformIndexHtml(html) {
      if (!enabled) {
        return html;
      }
      return (
        html
          .replaceAll(faryneSiteName, joyuSiteName)
          .replaceAll(faryneDescription, joyuDescription)
          .replaceAll(
            "https://faryne.dev/faryne-icon-1024.jpg",
            "https://joyu.fyi/joyu-og-default.jpg",
          )
          .replaceAll("https://faryne.dev", "https://joyu.fyi")
          .replace(
            /<link rel="icon"[^>]*>/,
            '<link rel="icon" type="image/png" href="/joyu-icon-256.png" />',
          )
          .replace(
            /<link rel="apple-touch-icon"[^>]*>/,
            '<link rel="apple-touch-icon" href="/joyu-icon-180.png" />',
          )
          // 成人內容標記：Google SafeSearch 靠它分辨，不用等 JS 執行
          .replace(
            '<meta name="robots"',
            '<meta name="rating" content="adult" />\n    <meta name="robots"',
          )
          // AdSense 不能出現在成人站上（違反政策會連累帳號），publisher ID 也會把兩站連在一起
          .replace(/<script[^>]*adsbygoogle[^>]*>\s*<\/script>/, "")
      );
    },
    generateBundle() {
      if (!enabled) {
        return;
      }
      this.emitFile({
        type: "asset",
        fileName: "favicon.ico",
        source: fs.readFileSync(
          path.resolve(__dirname, "../public/joyu-favicon.ico"),
        ),
      });
    },
  };
}

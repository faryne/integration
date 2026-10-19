import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@writer/App.tsx";
import i18n, { i18nReady } from "@writer/i18n/index.ts";
import { backend } from "@writer/lib/backend.ts";

async function start() {
  await i18nReady;
  try {
    const settings = await backend.ApplicationSettings();
    await i18n.changeLanguage(settings.language);
  } catch (error) {
    // 設定讀取失敗時仍用 i18n 的 zh-TW fallback 啟動；進入畫面後其他錯誤仍交給全域 snack。
    console.error("Unable to load Writer settings", error);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enApp from "./en/app.json";
import enAuth from "./en/auth.json";
import enProjects from "./en/projects.json";
import enSettings from "./en/settings.json";
import enWorkspace from "./en/workspace.json";
import jaApp from "./ja/app.json";
import jaAuth from "./ja/auth.json";
import jaProjects from "./ja/projects.json";
import jaSettings from "./ja/settings.json";
import jaWorkspace from "./ja/workspace.json";
import koApp from "./ko/app.json";
import koAuth from "./ko/auth.json";
import koProjects from "./ko/projects.json";
import koSettings from "./ko/settings.json";
import koWorkspace from "./ko/workspace.json";
import zhCNApp from "./zh-CN/app.json";
import zhCNAuth from "./zh-CN/auth.json";
import zhCNProjects from "./zh-CN/projects.json";
import zhCNSettings from "./zh-CN/settings.json";
import zhCNWorkspace from "./zh-CN/workspace.json";
import zhTWApp from "./zh-TW/app.json";
import zhTWAuth from "./zh-TW/auth.json";
import zhTWProjects from "./zh-TW/projects.json";
import zhTWSettings from "./zh-TW/settings.json";
import zhTWWorkspace from "./zh-TW/workspace.json";

const pack = (app: object, auth: object, projects: object, settings: object, workspace: object) => ({
  translation: { app, auth, projects, settings, workspace },
});

// 沿用網站的語系清單與分檔方式。畫面仍固定 zh-TW；其他語系已經掛上，之後改 lng 就能切。
void i18n.use(initReactI18next).init({
  lng: "zh-TW",
  fallbackLng: "zh-TW",
  supportedLngs: ["zh-TW", "zh-CN", "en", "ja", "ko"],
  resources: {
    "zh-TW": pack(zhTWApp, zhTWAuth, zhTWProjects, zhTWSettings, zhTWWorkspace),
    "zh-CN": pack(zhCNApp, zhCNAuth, zhCNProjects, zhCNSettings, zhCNWorkspace),
    en: pack(enApp, enAuth, enProjects, enSettings, enWorkspace),
    ja: pack(jaApp, jaAuth, jaProjects, jaSettings, jaWorkspace),
    ko: pack(koApp, koAuth, koProjects, koSettings, koWorkspace),
  },
  interpolation: { escapeValue: false },
});

export default i18n;

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhTWApp from "./zh-TW/app.json";
import zhTWAuth from "./zh-TW/auth.json";
import zhTWProjects from "./zh-TW/projects.json";
import zhTWWorkspace from "./zh-TW/workspace.json";

// 沿用網站的 i18n 慣例：i18n/<語系>/<功能>.json，key 是「功能.路徑」。目前只有 zh-TW。
void i18n.use(initReactI18next).init({
  lng: "zh-TW",
  fallbackLng: "zh-TW",
  resources: {
    "zh-TW": {
      translation: { app: zhTWApp, auth: zhTWAuth, projects: zhTWProjects, workspace: zhTWWorkspace },
    },
  },
  interpolation: { escapeValue: false },
});

export default i18n;

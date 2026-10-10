import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enModeration from "./en/moderation.json";
import jaModeration from "./ja/moderation.json";
import koModeration from "./ko/moderation.json";
import zhCNModeration from "./zh-CN/moderation.json";
import zhTWModeration from "./zh-TW/moderation.json";

// 全站 i18n（i18next＋react-i18next）。翻譯檔依功能分檔放在 i18n/<語系>/<功能>.json，
// 合併進同一個 translation namespace 底下的同名 key，所以 key 一律是「功能.路徑」，
// 例如 moderation.reason.spam。新增功能時加一個 JSON 檔、在下面 resources 掛上去即可。
// 元件裡用 useTranslation() 的 t（語系切換時會重新渲染）；非元件的 helper 用 i18n.t。
// 目前固定 zh-TW：其他頁面還是寫死中文，先不做語系偵測與切換器（免得同一頁中英混雜），
// en 資源先備好，全站搬完後再加偵測／切換（例如 i18next-browser-languagedetector）。
void i18n.use(initReactI18next).init({
  lng: "zh-TW",
  fallbackLng: "zh-TW",
  // 語系代碼用 BCP 47（韓文是 ko，不是國家碼 kr），跟 navigator.language 一致
  supportedLngs: ["zh-TW", "zh-CN", "en", "ja", "ko"],
  resources: {
    "zh-TW": {
      translation: {
        moderation: zhTWModeration,
      },
    },
    en: {
      translation: {
        moderation: enModeration,
      },
    },
    "zh-CN": {
      translation: {
        moderation: zhCNModeration,
      },
    },
    ja: {
      translation: {
        moderation: jaModeration,
      },
    },
    ko: {
      translation: {
        moderation: koModeration,
      },
    },
  },
  // React 自己會跳脫，不用 i18next 再處理一次
  interpolation: { escapeValue: false },
});

export default i18n;

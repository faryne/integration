import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enModeration from "./en/moderation.json";
import enWriter from "./en/writer.json";
import enWeb from "./en/web.json";
import jaModeration from "./ja/moderation.json";
import jaWriter from "./ja/writer.json";
import jaWeb from "./ja/web.json";
import koModeration from "./ko/moderation.json";
import koWriter from "./ko/writer.json";
import koWeb from "./ko/web.json";
import zhCNModeration from "./zh-CN/moderation.json";
import zhCNWriter from "./zh-CN/writer.json";
import zhCNWeb from "./zh-CN/web.json";
import zhTWModeration from "./zh-TW/moderation.json";
import zhTWWriter from "./zh-TW/writer.json";
import zhTWWeb from "./zh-TW/web.json";
import { getInitialStorytellerLanguage, persistStorytellerLanguage } from "./storytellerLanguage.ts";

// 全站 i18n（i18next＋react-i18next）。翻譯檔依功能分檔放在 i18n/<語系>/<功能>.json，
// 合併進同一個 translation namespace 底下的同名 key，所以 key 一律是「功能.路徑」，
// 例如 moderation.reason.spam。新增功能時加一個 JSON 檔、在下面 resources 掛上去即可。
// 元件裡用 useTranslation() 的 t（語系切換時會重新渲染）；非元件的 helper 用 i18n.t。
void i18n.use(initReactI18next).init({
  lng: getInitialStorytellerLanguage(),
  fallbackLng: "zh-TW",
  // 語系代碼用 BCP 47（韓文是 ko，不是國家碼 kr），跟 navigator.language 一致
  supportedLngs: ["zh-TW", "zh-CN", "en", "ja", "ko"],
  resources: {
    "zh-TW": {
      writer: zhTWWriter,
      translation: {
        moderation: zhTWModeration,
        writer: zhTWWriter,
        web: zhTWWeb,
      },
    },
    en: {
      writer: enWriter,
      translation: {
        moderation: enModeration,
        writer: enWriter,
        web: enWeb,
      },
    },
    "zh-CN": {
      writer: zhCNWriter,
      translation: {
        moderation: zhCNModeration,
        writer: zhCNWriter,
        web: zhCNWeb,
      },
    },
    ja: {
      writer: jaWriter,
      translation: {
        moderation: jaModeration,
        writer: jaWriter,
        web: jaWeb,
      },
    },
    ko: {
      writer: koWriter,
      translation: {
        moderation: koModeration,
        writer: koWriter,
        web: koWeb,
      },
    },
  },
  // React 自己會跳脫，不用 i18next 再處理一次
  interpolation: { escapeValue: false },
});

persistStorytellerLanguage(getInitialStorytellerLanguage());

export default i18n;

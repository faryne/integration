import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enModeration from "./en/moderation.json";
import enWriter from "./en/writer.json";
import enWeb from "./en/web.json";
import enCommon from "./en/common.json";
import enGalgame from "./en/galgame.json";
import jaModeration from "./ja/moderation.json";
import jaWriter from "./ja/writer.json";
import jaWeb from "./ja/web.json";
import jaCommon from "./ja/common.json";
import jaGalgame from "./ja/galgame.json";
import koModeration from "./ko/moderation.json";
import koWriter from "./ko/writer.json";
import koWeb from "./ko/web.json";
import koCommon from "./ko/common.json";
import koGalgame from "./ko/galgame.json";
import zhCNModeration from "./zh-CN/moderation.json";
import zhCNWriter from "./zh-CN/writer.json";
import zhCNWeb from "./zh-CN/web.json";
import zhCNCommon from "./zh-CN/common.json";
import zhCNGalgame from "./zh-CN/galgame.json";
import zhTWModeration from "./zh-TW/moderation.json";
import zhTWWriter from "./zh-TW/writer.json";
import zhTWWeb from "./zh-TW/web.json";
import zhTWCommon from "./zh-TW/common.json";
import zhTWGalgame from "./zh-TW/galgame.json";
import { getInitialInterfaceLanguage, persistInterfaceLanguage } from "./interfaceLanguage.ts";

// 全站 i18n（i18next＋react-i18next）。翻譯檔依功能分檔放在 i18n/<語系>/<功能>.json，
// 合併進同一個 translation namespace 底下的同名 key，所以 key 一律是「功能.路徑」，
// 例如 moderation.reason.spam。新增功能時加一個 JSON 檔、在下面 resources 掛上去即可。
// 元件裡用 useTranslation() 的 t（語系切換時會重新渲染）；非元件的 helper 用 i18n.t。
void i18n.use(initReactI18next).init({
  lng: getInitialInterfaceLanguage(),
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
        common: zhTWCommon,
        galgame: zhTWGalgame,
      },
    },
    en: {
      writer: enWriter,
      translation: {
        moderation: enModeration,
        writer: enWriter,
        web: enWeb,
        common: enCommon,
        galgame: enGalgame,
      },
    },
    "zh-CN": {
      writer: zhCNWriter,
      translation: {
        moderation: zhCNModeration,
        writer: zhCNWriter,
        web: zhCNWeb,
        common: zhCNCommon,
        galgame: zhCNGalgame,
      },
    },
    ja: {
      writer: jaWriter,
      translation: {
        moderation: jaModeration,
        writer: jaWriter,
        web: jaWeb,
        common: jaCommon,
        galgame: jaGalgame,
      },
    },
    ko: {
      writer: koWriter,
      translation: {
        moderation: koModeration,
        writer: koWriter,
        web: koWeb,
        common: koCommon,
        galgame: koGalgame,
      },
    },
  },
  // React 自己會跳脫，不用 i18next 再處理一次
  interpolation: { escapeValue: false },
});

persistInterfaceLanguage(getInitialInterfaceLanguage());

export default i18n;

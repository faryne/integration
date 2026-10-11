import { isSteamLoomSite, STEAMLOOM_PATH_PREFIX } from "@/helpers/steamloom.ts";

// 這次頁面載入要登入哪個品牌：storyteller（SteamLoom）或主站。
// 「打哪個 session 端點」（apis/auth/session.ts）跟「用哪個 Firebase 專案拿 ID token」
// （lib/firebase.ts）都看這一個值，兩者必須一致——後端每個品牌只收自己 Firebase 專案簽發的
// token（service/auth/firebase_token.go），各自判斷就會出現 invalid Firebase token issuer。
//
// 正式網域靠 isSteamLoomSite() 判斷網域名稱就夠了；本機開發網址是 localhost + /storyteller
// 前綴（見 steamloomPath()），isSteamLoomSite() 永遠判 false，所以 dev build 再疊加路徑判斷。
// 不能把路徑判斷塞進 isSteamLoomSite() 本身——steamloomPath() 靠它決定要不要加前綴，
// 兩者會互相依賴讓本機路由整個壞掉。品牌在載入時就決定，同一頁 SPA 切換主站／storyteller 不會跟著變。
export const isStorytellerAuthBrand =
  isSteamLoomSite() ||
  (import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.location.pathname.startsWith(STEAMLOOM_PATH_PREFIX));

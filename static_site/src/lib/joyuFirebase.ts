import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  type Auth,
} from "firebase/auth";

// joyu.fyi 的 Firebase（joyu-firebase 專案，Google＋匿名登入），跟主站的 lib/firebase.ts 完全分開：
// 用具名的 Firebase app，登入狀態、token 都不會跟主站混在一起。後端只收這個專案簽發的 ID token（middleware/joyuauth）

const config = {
  apiKey: import.meta.env.VITE_JOYU_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_JOYU_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_JOYU_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_JOYU_FIREBASE_APP_ID,
};

export const joyuFirebaseReady = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let ready: Promise<void> | null = null;

/** joyu 的 Firebase Auth；設定不齊時回 null（登入相關的 UI 不顯示） */
export function getJoyuAuth() {
  if (!joyuFirebaseReady) return null;
  if (!app) {
    app = initializeApp(config, "joyu");
    auth = getAuth(app);
    ready = setPersistence(auth, browserLocalPersistence);
  }
  return { auth: auth!, ready: ready! };
}

export function joyuGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

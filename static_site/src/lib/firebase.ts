import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { isStorytellerAuthBrand } from "@/apis/auth/brand.ts";

const mainFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};
const steamloomFirebaseConfig = {
  apiKey: import.meta.env.VITE_STEAMLOOM_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_STEAMLOOM_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_STEAMLOOM_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_STEAMLOOM_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_STEAMLOOM_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_STEAMLOOM_FIREBASE_STORAGE_BUCKET,
};

const isConfigComplete = (config: typeof mainFirebaseConfig) =>
  Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

// SteamLoom 有自己的 Firebase 專案（登入彈窗才會顯示 SteamLoom 品牌），跟 session 端點一樣
// 依 isStorytellerAuthBrand 選，本機 /storyteller 也會用 SteamLoom 專案。
// 沒設 VITE_STEAMLOOM_* 時退回共用專案，對應後端沒設 STORYTELLER_FIREBASE_PROJECT_ID 的 fallback。
const firebaseConfig =
  isStorytellerAuthBrand && isConfigComplete(steamloomFirebaseConfig)
    ? steamloomFirebaseConfig
    : mainFirebaseConfig;

export const firebaseConfigReady = isConfigComplete(firebaseConfig);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let persistenceReady: Promise<void> | null = null;

export function getFirebaseAuth() {
  if (!firebaseConfigReady) {
    return null;
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    persistenceReady = setPersistence(auth, browserLocalPersistence);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
  }

  return {
    auth: auth!,
    googleProvider: googleProvider!,
    persistenceReady: persistenceReady!,
  };
}

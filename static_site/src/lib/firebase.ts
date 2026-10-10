import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  type Auth,
} from "firebase/auth";

// SteamLoom 的 build（VITE_SITE=steamloom）改用自己的 Firebase 專案，登入彈窗才會顯示
// SteamLoom 品牌；後端 storyteller 登入也只收這個專案的 token（見 service/auth/firebase_token.go）。
// 本機開發沒帶 VITE_SITE，/storyteller 路徑仍走共用專案，跟後端未設
// STORYTELLER_FIREBASE_PROJECT_ID 時的 fallback 對齊。
const firebaseConfig =
  import.meta.env.VITE_SITE === "steamloom"
    ? {
        apiKey: import.meta.env.VITE_STEAMLOOM_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_STEAMLOOM_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_STEAMLOOM_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_STEAMLOOM_FIREBASE_APP_ID,
        messagingSenderId: import.meta.env
          .VITE_STEAMLOOM_FIREBASE_MESSAGING_SENDER_ID,
        storageBucket: import.meta.env.VITE_STEAMLOOM_FIREBASE_STORAGE_BUCKET,
      }
    : {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      };

export const firebaseConfigReady = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);

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

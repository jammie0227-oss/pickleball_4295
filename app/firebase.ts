import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 這裡會自動去讀取我們剛剛建好的 .env.local 保險箱
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 啟動 Firebase 引擎
const app = initializeApp(firebaseConfig);

// 啟動並匯出 Firestore (我們的即時資料庫)
export const db = getFirestore(app);
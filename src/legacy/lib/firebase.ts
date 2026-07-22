import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import jsonConfig from "./firebase-config.json";

const firebaseConfig = {
  apiKey: jsonConfig.apiKey,
  authDomain: jsonConfig.authDomain,
  projectId: jsonConfig.projectId,
  storageBucket: jsonConfig.storageBucket,
  messagingSenderId: jsonConfig.messagingSenderId,
  appId: jsonConfig.appId,
  measurementId: jsonConfig.measurementId,
};

const hasValidConfig = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

// Guard init so SSR (no window) does not crash. Firebase Auth needs a browser.
export let auth: any = null;
export let googleProvider: any = null;
export let db: any = null;
export let firebaseInitError: string | null = null;

if (typeof window !== "undefined" && hasValidConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    const dbName = jsonConfig.firestoreDatabaseId || "";
    db = dbName && dbName !== "(default)" ? getFirestore(app, dbName) : getFirestore(app);
  } catch (e: any) {
    console.error("Firebase init error:", e);
    firebaseInitError = e?.message || String(e);
  }
}

export { signInWithPopup, signOut };

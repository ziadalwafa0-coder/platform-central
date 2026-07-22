import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Injected by Vite define at build-time, with fallback for local dev/tests
declare const __FIREBASE_CONFIG_FROM_JSON__: any;

let jsonConfig: any = {};
try {
  if (typeof __FIREBASE_CONFIG_FROM_JSON__ !== "undefined") {
    jsonConfig = __FIREBASE_CONFIG_FROM_JSON__;
  }
} catch (e) {
  // Ignore in environments where global is not defined
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || jsonConfig.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || jsonConfig.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || jsonConfig.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || jsonConfig.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || jsonConfig.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || jsonConfig.appId || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || jsonConfig.measurementId || ""
};

// Validate if config is complete/valid
const hasValidConfig = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

if (!hasValidConfig) {
  console.warn("Firebase configuration is missing or incomplete. Authenticaton features may be restricted.");
}

// Initialize Firebase with fallback to prevent crash if config is completely empty
const app = initializeApp(hasValidConfig ? firebaseConfig : {
  apiKey: "mock-key-for-development-purposes",
  authDomain: "mock-domain.firebaseapp.com",
  projectId: "mock-project-id",
  appId: "1:12345678:web:abcdef12345"
});

// Initialize Firebase Auth
export let auth: any = null;
export let googleProvider: any = null;
export let db: any = null;
export let firebaseInitError: string | null = null;

try {
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (e: any) {
  console.error("Firebase Auth initialization error (likely due to iframe/storage restrictions):", e);
  firebaseInitError = e?.message || String(e);
}

// Initialize Firestore
try {
  const dbName = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || jsonConfig.firestoreDatabaseId || "";
  db = dbName && dbName !== "(default)"
    ? getFirestore(app, dbName)
    : getFirestore(app);
} catch (e: any) {
  console.error("Firestore initialization error:", e);
  if (!firebaseInitError) {
    firebaseInitError = e?.message || String(e);
  }
}

export { signInWithPopup, signOut };

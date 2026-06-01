import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ==========================================
// BLOK CONFIG: Silakan isi Firebase Config S1 MPAI Anda di bawah ini
// ==========================================
export const firebaseConfig = {
  apiKey: "AIzaSyDnuAgpT_7IGaI7USOKwMEFvWUHMLvILbg",
  authDomain: "gen-lang-client-0461452025.firebaseapp.com",
  projectId: "gen-lang-client-0461452025",
  storageBucket: "gen-lang-client-0461452025.firebasestorage.app",
  messagingSenderId: "136754742146",
  appId: "1:136754742146:web:d92743dcd72bac3bc6c59b"
};

// Coba memuat config yang dimasukkan secara dinamis di UI jika ada
let activeConfig = { ...firebaseConfig };
if (typeof window !== "undefined") {
  const customConfigStr = localStorage.getItem("mpaistudycove_firebase_config");
  if (customConfigStr) {
    try {
      const parsed = JSON.parse(customConfigStr);
      if (parsed && parsed.apiKey && parsed.apiKey !== "YOUR_API_KEY") {
        activeConfig = { ...parsed };
      }
    } catch (e) {
      console.error("Format config kustom di localStorage tidak valid", e);
    }
  }
}

let app: any = null;
let db: any = null;
let auth: any = null;
let storage: any = null;
let isFirebaseInitialized = false;

// Periksa apakah konfigurasi sudah diisi nilai riil oleh pengguna
const isConfigured = 
  activeConfig.apiKey && 
  activeConfig.apiKey !== "YOUR_API_KEY" && 
  activeConfig.apiKey.trim() !== "" && 
  !activeConfig.projectId.includes("YOUR_PROJECT");

if (isConfigured) {
  try {
    app = initializeApp(activeConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    isFirebaseInitialized = true;
    console.log("Firebase berhasil diinisialisasi.");
  } catch (error) {
    console.error("Gagal melakukan inisialisasi Firebase SDK:", error);
  }
} else {
  console.log("Firebase belum dikonfigurasi secara lengkap. Aplikasi berjalan dalam mode demonstrasi cerdas.");
}

export { app, db, auth, storage, isFirebaseInitialized };

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error detail:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

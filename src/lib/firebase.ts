import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keep Firestore's SDK cache in memory. BalkanBite owns its scoped local
// persistence separately, while cloud-backed inventory remains provisional
// until the authoritative Firestore snapshot hydrates. This avoids making
// browser persistent-storage quota part of the critical runtime path.
// AI Studio provisioned this named Firestore database in the Firebase project.
// Do not silently fall back to '(default)': that database does not exist.
export const FIRESTORE_DATABASE_ID = "ai-studio-balkanbite-9bd2735f-15da-4be1-a327-f9c6d29866b6";

export const db = initializeFirestore(
  app,
  { localCache: memoryLocalCache() },
  FIRESTORE_DATABASE_ID,
);

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code === "auth/popup-closed-by-user") {
      console.log("User intentionally closed the Google sign-in window.");
      return null;
    }
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, name: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  if (userCredential.user && name) {
    await updateProfile(userCredential.user, { displayName: name });
  }
  return userCredential.user;
};

export const loginWithEmail = async (email: string, pass: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
};

export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
};

export const logout = () => signOut(auth);

